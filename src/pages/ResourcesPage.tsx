import { BookOpen, HelpCircle, MessageSquareText, UsersRound, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getMyToolbag } from "../lib/driverData";

const resources = [
  ["/resources/toolbag", "My Toolbag", "Assigned inventory and quantities", Wrench],
  ["/resources/directory", "Driver Directory", "Names and phone numbers for the active team", UsersRound],
  ["/resources/red-folder", "Red Folder", "Pictures, documents, and operating guides", BookOpen],
  ["/resources/faq", "FAQ", "Frequently asked questions", HelpCircle],
  ["/resources/feedback", "Submit Feedback", "App or general feedback", MessageSquareText],
] as const;

export function ResourcesPage() {
  const { user } = useAuth();
  const toolbag = useAsync(() => getMyToolbag(user!.id), [user?.id]);
  return <main className="page"><header className="page-header"><div><p className="eyebrow">ON-THE-ROAD HELP</p><h1>Resources</h1><p>Choose the resource you need.</p></div></header><div className="resource-link-grid">{resources.map(([to, title, description, Icon]) => {
    const toolbagTitle = to === "/resources/toolbag" && toolbag.data ? `My Toolbag #${toolbag.data.number}` : title;
    const toolbagDescription = to === "/resources/toolbag" && toolbag.loading ? "Loading assigned toolbag…" : description;
    return <Link key={to} to={to}><Icon /><span><strong>{toolbagTitle}</strong><small>{toolbagDescription}</small></span><b>→</b></Link>;
  })}</div></main>;
}
