/**
 * Shared feedback sentiment helpers — extracted verbatim from
 * app/(staff)/feedback/page.tsx. Pure, no UI change.
 */

export const STOPWORDS = new Set(
  "a,an,and,are,as,at,be,been,being,but,by,can,could,did,do,does,each,few,for,from,had,has,have,here,how,i,if,in,into,is,it,its,just,like,me,more,most,my,no,not,now,of,off,on,once,only,or,other,our,out,over,own,same,she,should,so,some,such,than,that,the,their,them,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,will,with,you,your,session,sessions,counselor,counselors,really,very,much,lot,things,thing,feel,felt,also,after,before,again,always,never,ever,got,getting,going,went,come,came,today,yesterday,time,times,first,last,one,two,three,well,still,even,back,made,make,though,although,since,without,within,along,among,between,because,while,despite,toward,towards,upon,via,per".split(",")
);

export function sentimentOf(avg: number | null): { label: string; tone: "success" | "warning" | "danger" | "info"; hint: string } {
  if (avg === null) return { label: "No data yet", tone: "info", hint: "Ratings will appear once students respond." };
  if (avg >= 4.5) return { label: "Excellent", tone: "success", hint: "Students love the service — protect what's working." };
  if (avg >= 4.0) return { label: "Good", tone: "success", hint: "Solid overall. Mine the 3★ comments for quick wins." };
  if (avg >= 3.0) return { label: "Fair", tone: "warning", hint: "Mixed signals — review neutral and low comments below." };
  return { label: "Needs attention", tone: "danger", hint: "Satisfaction is low. Work the follow-up list first." };
}
