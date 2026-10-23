import { createFileRoute } from "@tanstack/react-router";
import { publicTrackingQuery } from "@/features/public/api";
import { TrackingStatus } from "@/features/public/tracking-status";

export const Route = createFileRoute("/seguimiento/$code")({
  loader: ({ context, params }) => {
    void context.queryClient.query(publicTrackingQuery(params.code)).catch(() => undefined);
  },
  component: TrackingPage,
});

function TrackingPage() {
  const { code } = Route.useParams();
  return <TrackingStatus code={code} />;
}
