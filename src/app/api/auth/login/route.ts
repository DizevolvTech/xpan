import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  authenticateUser,
  encodeSession,
  roleHomePath,
} from "@/lib/auth";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as LoginBody | null;

  if (!payload?.email || !payload?.password) {
    return NextResponse.json(
      { message: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const sessionUser = authenticateUser(payload.email, payload.password);
  if (!sessionUser) {
    return NextResponse.json(
      { message: "Credenciais inválidas." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    user: sessionUser,
    redirectTo: roleHomePath[sessionUser.role],
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSession(sessionUser),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
