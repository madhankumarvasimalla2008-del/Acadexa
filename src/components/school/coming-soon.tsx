import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#6b1d2a]">School administration</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">{title}</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 max-w-2xl text-zinc-600">
          This area is not available yet.
        </p>
      </div>
      <Card className="acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>{title}</CardTitle>
          <CardDescription>Marked as later until this module is implemented.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            kind="activity"
            title={`${title} will be added later`}
            description="Reports and analytics are not in this release. QR verification and digital receipts will follow in a later module."
          />
        </CardContent>
      </Card>
    </div>
  );
}
