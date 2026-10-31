
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const result = await signIn.username({
                username,
                password,
            });

            if (result.error) {
                setError("Nome de usuário ou senha inválidos.");
                return;
            }

            router.replace("/dashboard");
        } catch {
            setError("Não foi possível realizar o login. Tente novamente.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#101114] px-6 text-white">
            <section className="w-full max-w-md rounded-2xl border border-[#303238] bg-[#191a1f] p-8 shadow-2xl sm:p-10">
                <div className="mb-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#d6a441] text-xl font-extrabold text-[#171717]">
                        AG
                    </div>

                    <h1 className="mt-4 text-2xl font-bold tracking-[3px]">
                        ADEGA GS
                    </h1>

                    <p className="mt-1 text-sm text-gray-400">
                        Sistema de gestão
                    </p>
                </div>

                <div className="mb-7">
                    <h2 className="text-xl font-semibold">
                        Bem-vindo de volta
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Entre com suas credenciais para continuar.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="username" className="mb-2 block text-sm font-medium">
                            Nome de usuário
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="Digite seu usuário"
                            autoComplete="username"
                            required
                            className="w-full rounded-lg border border-[#383a42] bg-[#111216] px-4 py-3 text-sm outline-none transition focus:border-[#d6a441] focus:ring-1 focus:ring-[#d6a441]"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-medium">
                            Senha
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Digite sua senha"
                            autoComplete="current-password"
                            required
                            className="w-full rounded-lg border border-[#383a42] bg-[#111216] px-4 py-3 text-sm outline-none transition focus:border-[#d6a441] focus:ring-1 focus:ring-[#d6a441]"
                        />
                    </div>

                    {error && (
                        <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 rounded-lg bg-[#d6a441] px-4 py-3 font-bold text-[#171717] transition hover:bg-[#e6b957] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Entrando..." : "Entrar"}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-gray-500">
                    Acesso restrito aos funcionários.
                </p>
            </section>
        </main>
    );
}
