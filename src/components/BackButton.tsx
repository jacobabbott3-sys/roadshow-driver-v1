import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type BackButtonProps = {
  label: string;
  to?: string;
  onClick?: () => void;
  className?: string;
};

export function BackButton({ label, to, onClick, className = "" }: BackButtonProps) {
  const classes = `back-button ${className}`.trim();
  const content = <><ArrowLeft aria-hidden="true" /><span>{label}</span></>;
  if (to) return <Link className={classes} to={to}>{content}</Link>;
  return <button className={classes} type="button" onClick={onClick}>{content}</button>;
}
