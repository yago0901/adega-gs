"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

type StockMutationFormProps = {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
};

export function StockMutationForm({
  action,
  className,
  children,
}: StockMutationFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return (
    <form
      className={className}
      action={async (formData) => {
        await action(formData);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
          queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        ]);
        router.refresh();
      }}
    >
      {children}
    </form>
  );
}
