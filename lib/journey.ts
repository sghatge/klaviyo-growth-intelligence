export type NodeKind = "trigger" | "filter" | "wait" | "check" | "email" | "split" | "exit";
export type JourneyNode = { id: string; kind: NodeKind; title: string; detail: string };

export const HIGH_VALUE_THRESHOLD = 150;
export const WAIT_1_MIN = 60; // 1 hour
export const WAIT_2_MIN = 24 * 60; // 24 hours after email 1
export const WAIT_3_MIN = 48 * 60; // 48 hours after email 2
export const SIM_END_MIN = 96 * 60;

export const JOURNEY_NODES: JourneyNode[] = [
  { id: "trigger", kind: "trigger", title: "Trigger: Started Checkout", detail: "Metric-triggered. Exit condition: the profile leaves the moment they place an order." },
  { id: "filter", kind: "filter", title: "Entry filter: email consent", detail: "Only profiles subscribed to marketing email may enter." },
  { id: "wait1", kind: "wait", title: "Wait 1 hour", detail: "Gives shoppers time to finish on their own. An order here exits the flow." },
  { id: "email1", kind: "email", title: "Email 1 · Reassurance", detail: "Free preview, artist-reviewed. No discount." },
  { id: "wait2", kind: "wait", title: "Wait 24 hours", detail: "" },
  { id: "email2", kind: "email", title: "Email 2 · Social proof", detail: "How the portrait is made, reviews, process." },
  { id: "wait3", kind: "wait", title: "Wait 48 hours", detail: "" },
  { id: "split", kind: "split", title: `Split: cart value ≥ £${HIGH_VALUE_THRESHOLD}?`, detail: "High-value carts get a value-add, never a blanket discount." },
  { id: "email3a", kind: "email", title: "Email 3a · Value-add offer", detail: "High-value carts only." },
  { id: "email3b", kind: "email", title: "Email 3b · Last reminder", detail: "Standard carts." },
  { id: "exit", kind: "exit", title: "Exit", detail: "Order placed, not eligible, or sequence complete." },
];

export type SimInput = {
  firstName: string;
  productName: string;
  cartValue: number;
  consent: boolean;
  /** minutes after checkout start when the shopper buys; null = never */
  orderAtMin: number | null;
  offerText: string;
};

export type SimEvent = {
  t: number;
  node: string;
  kind: "enter" | "wait" | "check" | "send" | "order" | "exit" | "skip";
  title: string;
  detail: string;
};

export type EmailPreview = { subject: string; preheader: string; body: string; cta: string };

export type SimResult = {
  events: SimEvent[];
  emails: Array<{ t: number; node: string; email: EmailPreview }>;
  path: string[];
  emailsSent: number;
  converted: boolean;
  organic: boolean;
  attributedTo: string | null;
  recovered: number;
  exitReason: string;
};

export function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  if (h < 48) return rest ? `${h}h ${rest}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function emailFor(node: string, i: SimInput): EmailPreview {
  const name = i.firstName.trim() || "there"; // personalization fallback, a QA must-have
  const product = i.productName || "your portrait";
  switch (node) {
    case "email1":
      return { subject: `${name}, your ${product.toLowerCase()} is saved`, preheader: "Preview it free before you commit. Nothing is printed until you approve.", body: `Hi ${name},\n\nYou started ordering ${product} and we've kept your details safe. Every order includes a free digital preview, and our artist only begins the final piece once you approve it.\n\nPick up exactly where you left off.`, cta: "Return to checkout" };
    case "email2":
      return { subject: "How your portrait comes to life", preheader: "From your photo to a finished keepsake, step by step.", body: `Hi ${name},\n\nHere is what happens after you order ${product}: an artist studies your photo, sketches the composition, and shares a preview for your feedback before anything is finalised.\n\nSee the process and real customer results.`, cta: "See how it works" };
    case "email3a":
      return { subject: `${name}, a little extra with your ${product.toLowerCase()}`, preheader: i.offerText || "A thank-you for completing your order.", body: `Hi ${name},\n\nYour ${product} (£${i.cartValue}) is still waiting. ${i.offerText ? `Complete your order and enjoy: ${i.offerText}.` : "Complete your order and our team will prioritise your preview."}\n\nOffer terms and expiry must be confirmed before this email goes live.`, cta: "Complete my order" };
    default:
      return { subject: `Last reminder: ${product.toLowerCase()}`, preheader: "Your saved details won't be held forever.", body: `Hi ${name},\n\nThis is our final reminder about ${product}. If now isn't the right time, no problem. Your preview is free whenever you're ready.`, cta: "Finish my order" };
  }
}

export function simulate(input: SimInput): SimResult {
  const events: SimEvent[] = [];
  const emails: SimResult["emails"] = [];
  const path: string[] = [];
  const order = input.orderAtMin !== null && input.orderAtMin <= SIM_END_MIN ? input.orderAtMin : null;

  const result = (exitReason: string, tExit: number): SimResult => {
    path.push("exit");
    events.push({ t: tExit, node: "exit", kind: "exit", title: "Exit", detail: exitReason });
    const sent = emails.length;
    const converted = order !== null && input.consent;
    const organic = converted && sent === 0;
    // Only orders placed after at least one flow email count as recovered. Anything earlier is organic.
    const attributedTo = converted && !organic ? emails[sent - 1].node : null;
    return { events: [...events].sort((a, b) => a.t - b.t), emails, path, emailsSent: sent, converted, organic, attributedTo, recovered: attributedTo ? input.cartValue : 0, exitReason };
  };

  path.push("trigger");
  events.push({ t: 0, node: "trigger", kind: "enter", title: "Started Checkout", detail: `${input.firstName || "Shopper"} started checkout · ${input.productName} · £${input.cartValue}` });
  if (order !== null) events.push({ t: order, node: "order", kind: "order", title: "Placed Order", detail: `Order of £${input.cartValue} placed` });

  path.push("filter");
  if (!input.consent) {
    events.push({ t: 0, node: "filter", kind: "skip", title: "Blocked by consent filter", detail: "Profile is not subscribed to marketing email, so no emails are sent." });
    return result("Not eligible: no email marketing consent.", 0);
  }
  events.push({ t: 0, node: "filter", kind: "check", title: "Consent verified", detail: "Subscribed to email marketing." });

  /** One wait + one send. If the order lands inside the wait, the exit condition removes the profile right then. */
  const stage = (waitNode: string, sendNode: string, from: number, to: number, label: string): "exited" | "sent" => {
    path.push(waitNode);
    events.push({ t: from, node: waitNode, kind: "wait", title: `Waiting ${label}`, detail: "" });
    if (order !== null && order <= to) {
      const why = emails.length === 0 ? "Shopper bought on their own before any email. Organic, not recovered revenue." : `Order placed after email ${emails.length}. Exit condition removes them from the flow.`;
      events.push({ t: order, node: waitNode, kind: "check", title: "Order placed during wait → exit flow", detail: "Pending emails are cancelled." });
      exitReason = why; exitAt = order;
      return "exited";
    }
    path.push(sendNode);
    const email = emailFor(sendNode, input);
    emails.push({ t: to, node: sendNode, email });
    events.push({ t: to, node: sendNode, kind: "send", title: `Sent: ${email.subject}`, detail: email.preheader });
    return "sent";
  };
  let exitReason = "", exitAt = 0;

  const t1 = WAIT_1_MIN, t2 = t1 + WAIT_2_MIN, t3 = t2 + WAIT_3_MIN;
  if (stage("wait1", "email1", 0, t1, "1 hour") === "exited") return result(exitReason, exitAt);
  if (stage("wait2", "email2", t1, t2, "24 hours") === "exited") return result(exitReason, exitAt);

  // Third stage has the split between the wait and the send.
  path.push("wait3");
  events.push({ t: t2, node: "wait3", kind: "wait", title: "Waiting 48 hours", detail: "" });
  if (order !== null && order <= t3) {
    events.push({ t: order, node: "wait3", kind: "check", title: "Order placed during wait → exit flow", detail: "Pending emails are cancelled." });
    return result("Order placed after email 2. Exit condition removes them from the flow.", order);
  }
  path.push("split");
  const high = input.cartValue >= HIGH_VALUE_THRESHOLD;
  events.push({ t: t3, node: "split", kind: "check", title: high ? `High-value cart (£${input.cartValue})` : `Standard cart (£${input.cartValue})`, detail: high ? "Routed to the value-add email." : "Routed to the last-reminder email." });
  const node3 = high ? "email3a" : "email3b";
  path.push(node3);
  const email3 = emailFor(node3, input);
  emails.push({ t: t3, node: node3, email: email3 });
  events.push({ t: t3, node: node3, kind: "send", title: `Sent: ${email3.subject}`, detail: email3.preheader });

  if (order !== null && order > t3) return result("Order placed after the final email.", order);
  return result("Sequence complete. Shopper did not convert.", Math.min(t3 + 1, SIM_END_MIN));
}
