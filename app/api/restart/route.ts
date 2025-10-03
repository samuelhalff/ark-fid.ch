import { NextRequest, NextResponse } from 'next/server';

/**
 * Secure restart endpoint for Infomaniak hosting automation
 * 
 * When called with the correct secret token, this endpoint triggers process.exit(0),
 * which causes Infomaniak's orchestrator to automatically restart the application.
 * This is the recommended approach for automated deployments on Infomaniak's managed Node.js hosting.
 * 
 * Security: Uses a secret token from environment variables to prevent unauthorized restarts.
 * 
 * Usage: POST /api/restart with Authorization header: Bearer <RESTART_SECRET_TOKEN>
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Get the secret from environment
    const restartSecret = process.env.RESTART_SECRET_TOKEN;

    // Validate secret token
    if (!restartSecret) {
      console.error('[RESTART] RESTART_SECRET_TOKEN not configured');
      return NextResponse.json(
        { error: 'Restart endpoint not configured' },
        { status: 500 }
      );
    }

    if (!token || token !== restartSecret) {
      console.warn('[RESTART] Unauthorized restart attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Log the restart
    console.log('[RESTART] Authorized restart requested. Triggering graceful shutdown...');
    console.log('[RESTART] Infomaniak orchestrator will automatically restart the application.');

    // Send response before exiting
    const response = NextResponse.json({
      success: true,
      message: 'Restart initiated. Application will be restarted by Infomaniak orchestrator.',
      timestamp: new Date().toISOString(),
    });

    // Trigger the restart after a short delay to allow response to be sent
    // Infomaniak's orchestrator will detect the exit and restart the app
    setTimeout(() => {
      console.log('[RESTART] Exiting process. Infomaniak will restart...');
      process.exit(0);
    }, 500);

    return response;

  } catch (error) {
    console.error('[RESTART] Error in restart endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Reject other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
