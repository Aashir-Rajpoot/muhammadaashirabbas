// analytics.js
// Privacy-conscious page-view / visitor tracker for a static site.
// No IP addresses, no PII. Writes only (never reads) to Firestore, so this
// script needs zero elevated permissions — see firestore.rules.
//
// Definitions used by this system:
//  - View: one page load. Counted every time, including refreshes.
//  - Visitor: a browser, identified by a random ID stored in localStorage.
//  - Unique visitor (per day / all-time): a Visitor counted at most once
//    within that period, tracked via localStorage flags (approximate —
//    clearing storage or using another browser/device creates a "new" one).
//  - Returning visitor: a Visitor whose localStorage already had an ID
//    before this session started.

import { db } from "./firebase-config.js";
import {
  doc, setDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function detectDevice() {
  const ua = navigator.userAgent;
  if (/Mobi|Android(?!.*Tablet)|iPhone/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Other";
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function referrerDomain() {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (host === location.hostname) return "direct";
    return host;
  } catch { return "direct"; }
}

function safeKey(str) {
  // Firestore map keys can't contain '.', '/', '[', ']', '*', '~'
  return (str || "unknown").replace(/[.$/\[\]*~]/g, "_").slice(0, 60) || "unknown";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (client local isn't used to keep it simple/UTC-consistent)
}

function pageKey() {
  const p = location.pathname.replace(/\/$/, "") || "/";
  return safeKey(p === "" ? "/" : p);
}

async function track() {
  try {
    let visitorId = localStorage.getItem("aa_vid");
    const isNewVisitorEver = !visitorId;
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem("aa_vid", visitorId);
    }

    const today = todayStr();
    const lastDay = localStorage.getItem("aa_last_day");
    const isNewToday = lastDay !== today;
    if (isNewToday) localStorage.setItem("aa_last_day", today);

    // Once per browser tab/session, not once per page, so multi-page
    // browsing in one visit doesn't inflate visitor counts.
    const isNewSession = !sessionStorage.getItem("aa_session");
    if (isNewSession) sessionStorage.setItem("aa_session", "1");

    const device = detectDevice();
    const browser = detectBrowser();
    const os = detectOS();
    const ref = referrerDomain();
    const page = pageKey();

    const dailyRef = doc(db, "dailyStats", today);
    const totalsRef = doc(db, "stats", "totals");
    const visitorRef = doc(db, "visitors", visitorId);

    const dailyPayload = {
      date: today,
      views: increment(1),
      pages: { [page]: increment(1) },
      devices: { [device]: increment(1) },
      browsers: { [browser]: increment(1) },
      os: { [os]: increment(1) },
      referrers: { [ref]: increment(1) },
      lastUpdated: serverTimestamp()
    };
    if (isNewToday) dailyPayload.uniqueViews = increment(1);

    const totalsPayload = {
      totalViews: increment(1),
      pages: { [page]: increment(1) },
      devices: { [device]: increment(1) },
      browsers: { [browser]: increment(1) },
      os: { [os]: increment(1) },
      referrers: { [ref]: increment(1) },
      lastUpdated: serverTimestamp()
    };
    if (isNewVisitorEver) {
      totalsPayload.uniqueVisitors = increment(1);
      totalsPayload.newVisitors = increment(1);
    } else if (isNewSession) {
      totalsPayload.returningVisitors = increment(1);
    }

    const visitorPayload = {
      lastSeen: serverTimestamp(),
      device, browser, os,
      visitCount: increment(1)
    };
    if (isNewVisitorEver) visitorPayload.firstSeen = serverTimestamp();

    await Promise.all([
      setDoc(dailyRef, dailyPayload, { merge: true }),
      setDoc(totalsRef, totalsPayload, { merge: true }),
      setDoc(visitorRef, visitorPayload, { merge: true })
    ]);
  } catch (err) {
    // Never let analytics break the site.
    console.warn("analytics: skipped", err && err.message);
  }
}

track();