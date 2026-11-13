const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const layout = require("../src/lib/expo/layout/hall-layout.json");

const moduleCache = new Map();
function loadTs(file, overrides = {}) {
    file = path.normalize(file);
    if (moduleCache.has(file)) return moduleCache.get(file);
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const mod = { exports: {} };
    const localRequire = (name) => {
        if (overrides[name]) return overrides[name];
        if (name === "@/lib/expo/layout/hall-layout.json") return layout;
        if (name.startsWith(".")) return loadTs(path.join(path.dirname(file), name + ".ts"), overrides);
        return require(name);
    };
    new Function("require", "module", "exports", js)(localRequire, mod, mod.exports);
    moduleCache.set(file, mod.exports);
    return mod.exports;
}
const { smallStalls, getSmallStall, getStallArrival } = loadTs("src/components/expo/stalls/stallLayout.ts");

test("every small stall arrival is inside the hall, outside all stalls, and faces its entrance", () => {
    for (const stall of smallStalls) {
        const { position: [x, , z], yaw } = getStallArrival(stall);
        assert.ok(x >= layout.hall.min.x + .42 && x <= layout.hall.max.x - .42, stall.id);
        assert.ok(z >= layout.hall.min.z + .42 && z <= layout.hall.max.z - .42, stall.id);
        for (const other of layout.stalls) {
            const nearestX = Math.max(other.footprint_x[0], Math.min(x, other.footprint_x[1]));
            const nearestZ = Math.max(other.footprint_z[0], Math.min(z, other.footprint_z[1]));
            assert.ok((x - nearestX) ** 2 + (z - nearestZ) ** 2 >= .42 ** 2, `${stall.id} overlaps ${other.id}`);
        }
        assert.ok(-Math.cos(yaw) * (stall.center[2] - z) > 0, `${stall.id} camera faces away`);
    }
});
test("invalid stall IDs safely use the default hall entrance", () => {
    assert.equal(getSmallStall("not-a-stall"), undefined);
    assert.equal(getSmallStall("L1"), undefined);
    assert.deepEqual(getStallArrival().position, layout.player_spawn.position);
});

test("uploads preserve other stalls and slots, reject invalid files, and release replaced images", async () => {
    const originalImage = global.Image;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const revoked = [];
    let count = 0;
    URL.createObjectURL = () => `blob:test-${++count}`;
    URL.revokeObjectURL = (url) => revoked.push(url);
    global.Image = class { decode() { return Promise.resolve(); } };
    try {
        const { uploadStallImage, useStallMediaStore } = loadTs("src/components/expo/stalls/stallMediaStore.ts");
        const file = { type: "image/png", size: 100 };
        await uploadStallImage("S1", "back_screen", file);
        await uploadStallImage("S2", "left_wall", file);
        await uploadStallImage("S1", "front_desk", file);
        await uploadStallImage("S1", "back_screen", file);
        const media = () => useStallMediaStore.getState().mediaByStall;
        assert.equal(media().S1.back_screen.url, "blob:test-4");
        assert.equal(media().S1.front_desk.url, "blob:test-3");
        assert.equal(media().S2.left_wall.url, "blob:test-2");
        assert.ok(revoked.includes("blob:test-1"));
        await assert.rejects(uploadStallImage("S1", "back_screen", { type: "text/plain", size: 5 }), /JPG/);
        await assert.rejects(uploadStallImage("S1", "back_screen", { ...file, size: 10 * 1024 * 1024 + 1 }), /10 MB/);
        global.Image = class { decode() { return Promise.reject(new Error("bad image")); } };
        await assert.rejects(uploadStallImage("S1", "back_screen", file), /could not be opened/);
        assert.equal(media().S1.back_screen.url, "blob:test-4");
        assert.ok(revoked.includes("blob:test-5"));
        useStallMediaStore.getState().removeImage("S1", "back_screen");
        assert.equal(media().S1.back_screen, undefined);
        assert.equal(media().S2.left_wall.url, "blob:test-2");
        assert.ok(revoked.includes("blob:test-4"));
    } finally {
        global.Image = originalImage;
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    }
});


test("back-screen videos are isolated, validated, and cleaned up only after their final reader releases", async () => {
    const originals = { document: global.document, Image: global.Image, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const revoked = [];
    const videos = [];
    const cleanups = [];
    const loaded = [];
    let nextUrl = 0;
    let failDecode = false;
    class FakeVideo extends EventTarget {
        videoWidth = 1920;
        videoHeight = 1080;
        src = "";
        paused = false;
        cancelledFrames = [];
        requestVideoFrameCallback() { return 1; }
        cancelVideoFrameCallback(id) { this.cancelledFrames.push(id); }
        play() { this.paused = false; this.load(); return Promise.resolve(); }
        pause() { this.paused = true; }
        removeAttribute(name) { if (name === "src") this.src = ""; }
        load() {
            if (this.src) queueMicrotask(() => this.dispatchEvent(new Event(failDecode ? "error" : "loadeddata")));
        }
    }
    global.document = { createElement: () => { const video = new FakeVideo(); videos.push(video); return video; } };
    global.Image = class { decode() { return Promise.resolve(); } };
    URL.createObjectURL = () => `blob:video-test-${++nextUrl}`;
    URL.revokeObjectURL = (url) => revoked.push(url);
    const { uploadStallMedia, useStallMediaStore } = loadTs("src/components/expo/stalls/stallMediaStore.ts");
    const { retainMediaUrl } = loadTs("src/components/expo/stalls/stallMediaUrls.ts");
    const store = useStallMediaStore.getState();
    const media = () => useStallMediaStore.getState().mediaByStall;
    const file = { type: "video/mp4", size: 100 };
    try {
        for (const slot of ["left_wall", "right_wall", "front_desk"]) {
            await assert.rejects(uploadStallMedia("S1", slot, file), /back screen only/);
            assert.throws(() => store.setMedia("S1", slot, { url: "blob:invalid", type: "video" }), /back screen only/);
        }
        await uploadStallMedia("S1", "back_screen", file);
        const firstUrl = media().S1.back_screen.url;
        assert.equal(media().S1.back_screen.type, "video");
        assert.equal(videos[0].src, "");
        assert.ok(videos[0].paused, "validation decoder must be stopped");
        assert.ok(!revoked.includes(firstUrl), "stored URL survives validation cleanup");
        const renderer = loadTs("src/components/expo/stalls/StallVideoPlane.tsx", {
            react: { useEffect: (setup) => cleanups.push(setup()), useState: () => [null, (value) => loaded.push(value)] },
        }).default;
        const props = { url: firstUrl, position: [0, 2, 0], size: [4, 2] };
        renderer(props);
        await Promise.resolve();
        const firstVideo = videos.at(-1);
        assert.ok(firstVideo.muted && firstVideo.defaultMuted && firstVideo.loop && firstVideo.autoplay && firstVideo.playsInline);
        assert.equal(loaded.at(-1).texture.isVideoTexture, true);
        let disposed = 0;
        loaded.at(-1).texture.addEventListener("dispose", () => disposed++);
        // Two displays can temporarily read the same URL during a route transition.
        const releaseOtherReader = retainMediaUrl(firstUrl);
        await uploadStallMedia("S2", "back_screen", { ...file, type: "video/webm" });
        renderer({ ...props, url: media().S2.back_screen.url });
        await Promise.resolve();
        assert.notEqual(videos.at(-1), firstVideo, "stalls must own separate video elements");
        await uploadStallMedia("S1", "back_screen", { type: "image/png", size: 100 });
        assert.equal(media().S1.back_screen.type, "image");
        assert.equal(media().S2.back_screen.type, "video");
        assert.ok(!revoked.includes(firstUrl));
        cleanups[0]();
        assert.ok(firstVideo.paused);
        assert.equal(firstVideo.src, "");
        assert.equal(disposed, 1);
        assert.deepEqual(firstVideo.cancelledFrames, [1]);
        assert.ok(!revoked.includes(firstUrl), "another reader still holds the replaced URL");
        releaseOtherReader();
        releaseOtherReader();
        assert.equal(revoked.filter((url) => url === firstUrl).length, 1);
        const oldItem = media().S1.back_screen;
        failDecode = true;
        await assert.rejects(uploadStallMedia("S1", "back_screen", file), /could not be opened/);
        assert.equal(media().S1.back_screen, oldItem, "invalid video preserves the previous image");
        assert.ok(revoked.includes(`blob:video-test-${nextUrl}`));
        failDecode = false;
        await assert.rejects(uploadStallMedia("S1", "back_screen", { ...file, size: 10 * 1024 * 1024 + 1 }), /10 MB/);
        await uploadStallMedia("S1", "back_screen", file);
        assert.equal(media().S1.back_screen.type, "video", "image can be replaced by video again");
        const s2Url = media().S2.back_screen.url;
        cleanups[1]();
        assert.ok(!revoked.includes(s2Url), "route unmount must preserve stored video for remount");
        store.removeImage("S2", "back_screen");
        assert.ok(revoked.includes(s2Url));
    } finally {
        cleanups.forEach((cleanup) => cleanup());
        store.removeImage("S1", "back_screen");
        store.removeImage("S2", "back_screen");
        global.document = originals.document;
        global.Image = originals.Image;
        URL.createObjectURL = originals.create;
        URL.revokeObjectURL = originals.revoke;
    }
});
