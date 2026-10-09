// Paste into the browser console on https://www.instagram.com/tsv.womenstore/ while logged in.
// Reads the store's posts (captions + largest photo URLs) and downloads tsv-instagram.json. Sends nothing anywhere.
(async () => {
  const USER = "tsv.womenstore";
  const H = { "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const posts = [];
  let total = null;

  async function getJson(url) {
    const res = await fetch(url, { headers: H, credentials: "include" });
    if (res.status === 429) throw new Error("Instagram says 'too many requests' — wait 15–30 minutes, then run again.");
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("json")) throw new Error(`Instagram answered ${res.status} (are you logged in?)`);
    return res.json();
  }

  function addItems(items) {
    for (const it of items) {
      const media = it.carousel_media ?? [it];
      posts.push({
        code: it.code,
        taken_at: it.taken_at,
        type: { 1: "photo", 2: "video", 8: "carousel" }[it.media_type] ?? String(it.media_type),
        caption: it.caption?.text ?? "",
        images: media.filter((m) => m.image_versions2).map((m) => m.image_versions2.candidates[0].url),
      });
    }
  }

  function save() {
    const data = { username: USER, exported_at: new Date().toISOString(), total_on_profile: total, posts };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "tsv-instagram.json";
    a.click();
    console.log(`✓ Saved ${posts.length} posts → tsv-instagram.json`);
  }

  try {
    // Feed by username: no separate profile lookup (that endpoint is heavily rate-limited).
    let j = await getJson(`/api/v1/feed/user/${USER}/username/?count=33`);
    const userId = j.user?.pk ?? j.items?.[0]?.user?.pk;
    total = j.user?.media_count ?? null;
    addItems(j.items ?? []);
    console.log(`… ${posts.length} posts`);
    for (let page = 0; page < 15 && j.more_available && userId; page++) {
      await sleep(3000); // gentle on the account
      j = await getJson(`/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(j.next_max_id)}`);
      addItems(j.items ?? []);
      console.log(`… ${posts.length} posts`);
    }
  } catch (err) {
    console.warn(err.message);
  }
  if (posts.length) save();
  else console.warn("Nothing saved yet. Wait a bit and run the script again.");
})();
