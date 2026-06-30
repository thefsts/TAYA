import { NextResponse } from 'next/server';

/**
 * POST /api/waiver
 *
 * Accepts a signed waiver submission from the training-waiver page.
 *
 * TODO: Connect to a real database (e.g., Supabase, PlanetScale, MongoDB)
 *       - Store waiver data with timestamp
 *       - Send confirmation email to student
 *       - Notify instructor of new waiver
 *       - Generate PDF copy for records
 *
 * For now, this route logs the submission and returns a success response.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.fullName || !body.email || !body.typedSignature) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, email, typedSignature' },
        { status: 400 }
      );
    }

    if (!body.acknowledgments || typeof body.acknowledgments !== 'object') {
      return NextResponse.json(
        { error: 'Missing acknowledgments' },
        { status: 400 }
      );
    }

    // Verify all acknowledgments are checked
    const allAcknowledged = Object.values(body.acknowledgments).every(Boolean);
    if (!allAcknowledged) {
      return NextResponse.json(
        { error: 'All acknowledgments must be accepted' },
        { status: 400 }
      );
    }

    // TODO: Save to database
    // await db.waivers.create({ data: body });

    // TODO: Send confirmation email
    // await sendEmail({ to: body.email, template: 'waiver-confirmation' });

    // TODO: Notify instructor
    // await sendEmail({ to: 'corsairtacticalsolutions@gmail.com', template: 'new-waiver', data: body });

    // Log for development
    console.log('[Waiver API] Submission received:', {
      name: body.fullName,
      email: body.email,
      course: body.course,
      instructor: body.instructor,
      signedAt: body.submittedAt,
      allAcknowledged,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Waiver signed and recorded successfully.',
        waiverId: `WVR-${Date.now()}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Waiver API] Error processing submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}