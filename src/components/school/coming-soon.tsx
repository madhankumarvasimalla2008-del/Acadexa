import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>This module is not part of Phase 0.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600">
        Catalogs, packs, inventory, payments, distribution, and reports will be
        added in a later phase. No placeholder data is shown here.
      </CardContent>
    </Card>
  );
}
