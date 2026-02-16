
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const logs = logger.getLogs(limit);

    return NextResponse.json({
        success: true,
        logs
    });
}

export async function DELETE() {
    logger.clear();
    return NextResponse.json({ success: true, message: 'Logs cleared' });
}
