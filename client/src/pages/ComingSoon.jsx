import { Clock } from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";

export default function ComingSoon({ title, icon: Icon, description, phase }) {
  return (
    <AppLayout title={title}>
      <div className="coming-soon">
        <div className="coming-soon__icon">
          {Icon ? <Icon size={28} /> : <Clock size={28} />}
        </div>
        <span className="coming-soon__pill">
          <Clock size={11} />
          {phase || "Coming soon"}
        </span>
        <h2>{title}</h2>
        <p>
          {description ||
            "This feature is being built as part of the next phase. Check back soon."}
        </p>
      </div>
    </AppLayout>
  );
}
