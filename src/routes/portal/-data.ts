import { useErp } from "@/lib/erp-store";

/** Portal kullanıcısının görebileceği veriler (yalnızca kendi müvekkil kaydı). */
export function usePortalData() {
  const { state, currentUser } = useErp();
  const client = state.clients.find((c) => c.id === currentUser.clientId);
  const cases = client
    ? state.cases.filter((c) => c.clientId === client.id && c.portalVisible)
    : [];
  const caseIds = new Set(cases.map((c) => c.id));
  const events = client
    ? state.reminders
        .filter(
          (r) =>
            r.portalVisible &&
            r.status !== "İptal" &&
            (r.clientId === client.id || (r.caseId && caseIds.has(r.caseId))),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const documents = client
    ? state.documents.filter(
        (d) =>
          d.visibleToClient && (d.clientId === client.id || (d.caseId && caseIds.has(d.caseId))),
      )
    : [];
  const requests = client ? state.docRequests.filter((r) => r.clientId === client.id) : [];
  const unread = client
    ? state.messages.filter((m) => m.clientId === client.id && !m.readByClient).length
    : 0;
  return { client, cases, events, documents, requests, unread };
}
