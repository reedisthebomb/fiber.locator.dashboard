/*
Paste this into DevTools Console while logged in at:
https://geocall.arkonecall.com/geocall/portal

It prompts for Arkansas One Call ticket numbers, uses your active browser
session, looks up the internal GeoCall ticket ID, fetches the printable
ticket HTML page, extracts POLYGON((...)) when present, and downloads JSON.

No cookie is stored in this file. The browser supplies your current session.
*/
(async () => {
  const base = "https://geocall.arkonecall.com";

  const fetchText = async (url) => {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.text();
  };

  const extractTicketId = (text) => {
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const record = xml.querySelector("record[ticketId]");
    if (record) return record.getAttribute("ticketId");

    const match = text.match(/ticketId=["'](\d+)["']/i);
    if (match) return match[1];
    throw new Error("No internal ticketId found in lookup response");
  };

  const extractPolygon = (text) => {
    const match = text.match(/POLYGON\s*\(\(.*?\)\)/is);
    if (!match) return "";
    const textarea = document.createElement("textarea");
    textarea.innerHTML = match[0];
    return textarea.value;
  };

  const lookupTicketId = async (ticketNumber) => {
    const params = new URLSearchParams({
      number: ticketNumber,
      _dc: String(Date.now()),
    });
    const url = `${base}/geocall/api/ui/searches/mp-noui-ticket-bynumber/execute?${params}`;
    const text = await fetchText(url);
    return extractTicketId(text);
  };

  const fetchTicketDetail = async (ticketId) => {
    const url = `${base}/geocall/client/item/ticket/${ticketId}?pr=true`;
    const html = await fetchText(url);
    return {
      sourceUrl: url,
      html,
      polygon: extractPolygon(html),
    };
  };

  const input = prompt("Enter ticket numbers separated by spaces or commas:", "260501-0290");
  if (!input) return;

  const ticketNumbers = input.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
  const tickets = [];
  const failures = [];

  for (const ticketNumber of ticketNumbers) {
    try {
      console.log(`Looking up ${ticketNumber}`);
      const ticketId = await lookupTicketId(ticketNumber);
      const detail = await fetchTicketDetail(ticketId);
      tickets.push({ ticketNumber, ticketId, ...detail });
      console.log(`${ticketNumber}: saved detail page ${ticketId}`);
    } catch (error) {
      failures.push(`${ticketNumber}: ${error.message}`);
      console.error(`${ticketNumber}:`, error);
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    tickets,
    failures,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(":", "").slice(0, 15);
  link.href = url;
  link.download = `arkonecall_ticket_details_${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  const message = failures.length
    ? `Downloaded details for ${tickets.length} ticket(s).\n\nFailures:\n${failures.join("\n\n")}`
    : `Downloaded details for ${tickets.length} ticket(s).`;
  alert(message);
})();
