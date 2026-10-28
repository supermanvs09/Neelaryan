import { notFound } from "next/navigation";
import SpriteStudio from "./SpriteStudio";

/** Dev-only tool that renders the ingredient / bowl cut-outs used by the app. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SpriteStudio />;
}
