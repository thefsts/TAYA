import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export interface SeedCourse {
  slug: string;
  status?: string;
  isPublished?: boolean;
  priceCents?: number | null;
  contactOnly?: boolean;
  externalCourse?: boolean;
  externalCheckout?: boolean;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!("name" in property) || !property.name) return undefined;
  return ts.isIdentifier(property.name) ||
    ts.isStringLiteral(property.name) ||
    ts.isNumericLiteral(property.name)
    ? property.name.text
    : undefined;
}

function property(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && propertyName(candidate) === name,
  );
}

function optionalString(object: ts.ObjectLiteralExpression, name: string): string | undefined {
  const candidate = property(object, name);
  if (!candidate) return undefined;
  const value = unwrap(candidate.initializer);
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)
    ? value.text
    : undefined;
}

function optionalBoolean(object: ts.ObjectLiteralExpression, name: string): boolean | undefined {
  const candidate = property(object, name);
  if (!candidate) return undefined;
  const value = unwrap(candidate.initializer);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function optionalPriceCents(object: ts.ObjectLiteralExpression): number | null | undefined {
  const candidate = property(object, "priceCents");
  if (!candidate) return undefined;
  const value = unwrap(candidate.initializer);
  if (value.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  if (
    ts.isPrefixUnaryExpression(value) &&
    (value.operator === ts.SyntaxKind.MinusToken || value.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(value.operand)
  ) {
    const amount = Number(value.operand.text);
    return value.operator === ts.SyntaxKind.MinusToken ? -amount : amount;
  }
  return undefined;
}

function coursesFromArray(
  array: ts.ArrayLiteralExpression,
  arrayName: string,
  sourcePath: string,
): SeedCourse[] {
  return array.elements.map((entry, index) => {
    const value = unwrap(entry);
    if (!ts.isObjectLiteralExpression(value)) {
      throw new Error(`Course entry ${index + 1} in ${arrayName} (${sourcePath}) is not an object literal.`);
    }

    const slug = optionalString(value, "slug");
    if (!slug) {
      throw new Error(`Course entry ${index + 1} in ${arrayName} (${sourcePath}) has no static slug.`);
    }

    return {
      slug,
      status: optionalString(value, "status"),
      isPublished: optionalBoolean(value, "isPublished"),
      priceCents: optionalPriceCents(value),
      contactOnly: optionalBoolean(value, "contactOnly"),
      externalCourse: optionalBoolean(value, "externalCourse"),
      externalCheckout: optionalBoolean(value, "externalCheckout"),
    };
  });
}

/**
 * Extracts every course array that can seed the Corsair public catalog.
 * Keeping this static means the check can run during every build without
 * database credentials.
 */
export function extractSeedCourses(sourceText: string, sourcePath = "convex/seedCorsair.ts"): SeedCourse[] {
  const source = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const requiredArrays = new Set(["courses", "courseDefs"]);
  const arrays = new Map<string, ts.ArrayLiteralExpression>();
  const findCourseArrays = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      requiredArrays.has(node.name.text) &&
      node.initializer &&
      ts.isArrayLiteralExpression(unwrap(node.initializer))
    ) {
      arrays.set(node.name.text, unwrap(node.initializer) as ts.ArrayLiteralExpression);
    }
    ts.forEachChild(node, findCourseArrays);
  };
  findCourseArrays(source);

  for (const arrayName of requiredArrays) {
    if (!arrays.has(arrayName)) {
      throw new Error(`Could not find the ${arrayName} catalog array in ${sourcePath}.`);
    }
  }

  return [...requiredArrays].flatMap((arrayName) =>
    coursesFromArray(arrays.get(arrayName)!, arrayName, sourcePath),
  );
}

/** Returns human-readable errors for published courses that cannot use Square checkout safely. */
export function validatePublishedCoursePricing(courses: SeedCourse[]): string[] {
  const failures: string[] = [];

  for (const course of courses) {
    const published = course.isPublished === true || course.status === "published";
    const exempt = course.contactOnly === true ||
      course.externalCourse === true ||
      course.externalCheckout === true;
    if (!published || exempt) continue;

    const price = course.priceCents;
    if (price === null || price === undefined) {
      failures.push(`Course "${course.slug}" is published but has no priceCents value.`);
    } else if (!Number.isFinite(price) || !Number.isInteger(price) || price <= 0) {
      failures.push(
        `Course "${course.slug}" is published but priceCents must be a positive integer; received ${price}.`,
      );
    }
  }

  return failures;
}

export function validateSeedCatalogFile(filePath: string): { courses: SeedCourse[]; failures: string[] } {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const courses = extractSeedCourses(sourceText, filePath);
  return { courses, failures: validatePublishedCoursePricing(courses) };
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const defaultCatalogPath = path.resolve(scriptDirectory, "../../convex/seedCorsair.ts");
  const catalogPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : defaultCatalogPath;
  const { courses, failures } = validateSeedCatalogFile(catalogPath);

  if (failures.length > 0) {
    console.error("Catalog price validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const payableCourses = courses.filter((course) => {
    const published = course.isPublished === true || course.status === "published";
    return published && !course.contactOnly && !course.externalCourse && !course.externalCheckout;
  });
  console.log(
    `Catalog price validation passed: ${payableCourses.length} published, payable course(s) have positive priceCents.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}