import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { title, content, userEmail } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: process.env.ADMIN_EMAIL || 'gh7878@naver.com',
      subject: `[문의하기] ${title}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">새로운 서비스 문의</h2>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>제목:</strong> ${title}</p>
          <p><strong>발신 이메일:</strong> ${userEmail || '익명'}</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <strong>문의 내용:</strong><br />
            <p style="white-space: pre-wrap;">${content}</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">이 메일은 스마트 위험성 평가 시스템 문의하기 기능을 통해 발송되었습니다.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Contact API Error:', error);
    return NextResponse.json(
      { error: '문의를 전송하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

