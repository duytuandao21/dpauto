import { AssignmentHistory } from "@/components/admin/assignment-history";
import { VisitAssignmentHistory } from "@/components/advisor/visit-assignment-history";
export default function HistoryPage() {
  return (
    <>
      <AssignmentHistory />
      <VisitAssignmentHistory />
    </>
  );
}
