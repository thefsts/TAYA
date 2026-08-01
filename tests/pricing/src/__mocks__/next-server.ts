/**
 * Minimal NextResponse shim for Vitest.
 * The route handlers under @/app/api/square/ import NextResponse from
 * 'next/server'. This shim replaces that module so the routes can run
 * in a plain Node.js environment without a full Next.js runtime.
 */
export class NextResponse {
  readonly status: number;
  readonly ok: boolean;
  private _body: unknown;

  constructor(body: unknown, init?: { status?: number }) {
    this.status = init?.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this._body = body;
  }

  async json(): Promise<unknown> {
    return this._body;
  }

  static json(body: unknown, init?: { status?: number }): NextResponse {
    return new NextResponse(body, init);
  }
}
