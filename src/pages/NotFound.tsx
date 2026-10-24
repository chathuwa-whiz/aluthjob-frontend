import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/Bits";
import { buttonClass } from "../components/Button";
import { usePageTitle } from "../lib/usePageTitle";

export function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="panel">
      <EmptyState icon={<Compass size={22} aria-hidden="true" />} title="That page does not exist" actions={<Link className={buttonClass("primary")} to="/">Go to your matches</Link>}>
        The address may be mistyped, or the page may have moved.
      </EmptyState>
    </div>
  );
}
