import { createFileRoute } from "@tanstack/react-router";
import { CostumeScout } from "@/components/costume-scout";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CostumeScout />;
}
