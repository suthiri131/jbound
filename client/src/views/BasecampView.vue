<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useTripsStore } from "@/stores/trips";
import { useCampPresence } from "@/composables/useCampPresence";
import { useCampSky } from "@/composables/useCampSky";
import { useCampMusic } from "@/composables/useCampMusic"
import { shortDate } from "@/utils/format";
import CampScene from "@/components/basecamp/CampScene.vue";

const auth = useAuthStore();
const trips = useTripsStore();
const router = useRouter();
const PRIVATE_STATIONS = ['trips', 'tales', 'ledger', 'archives'];
const locked = computed(() => (auth.user ? [] : PRIVATE_STATIONS));

function onLocked(station) {
  if (props.preview) emit('locked', station);
  else router.push({ name: 'sign-in', query: { next: station.to } });
};

const props = defineProps({
  preview: { type: Boolean, default: false },
  viewShift: { type: Object, default: () => ({ x: 0, y: 0 }) }
});
const emit = defineEmits(["locked"]);

// Which station you just walked out of (nav link, back button...), so the camera can pull back from it.
const STATION_FOR_PATH = [
  [/^\/planner/, "trips"],
  [/^\/watcher/, "watcher"],
  [/^\/tales/, "tales"],
  [/^\/ledger/, "ledger"],
  [/^\/archives/, "archives"],
  [/^\/explorer/, "explorer"],
];
const back = router.options.history.state?.back || "";
const returnFrom = STATION_FOR_PATH.find(([re]) => re.test(back))?.[1] || null;

// ---------- live one-liners in each station's bubble ----------
const subtitles = reactive({
  watcher: "Check the queue",
  explorer: "Live picks from Google Maps",
  trips: "Plan with your crew",
  tales: "Read and share reviews",
  archives: "Past trip scrapbooks",
  ledger: "Split costs in S$ and RM",
});

const traffic = reactive({ toJb: undefined, toSg: undefined });
const sgd = (n) => `S$${Number(n || 0).toFixed(2)}`;

// ---------- sky: Singapore's clock + NEA forecast, with a manual day/night override ----------
const { mode, condition, forecast, forced, isNight, modeLabel, cycleMode, conditionLabel } = useCampSky();

// background music: day and night playlists, swapped when the sky changes
const music = useCampMusic();

// ---------- you + your crew ----------
const me = computed(() =>
  auth.user ? { id: auth.user.id, name: auth.profile?.name || auth.firstName || "You", look: auth.profile?.look } : { id: "guest", name: "You", look: null },
);
const crew = ref([]);
const presence = useCampPresence();
const offlineCrew = computed(() => crew.value.filter((m) => !presence.online[m.id]));
const onlineCount = computed(() => Object.keys(presence.online).length);

// ---------- next trip card ----------
const nextTrip = computed(() => {
  const upcoming = trips.trips
    .filter((t) => t.phase === "on_the_road" || t.phase === "planning")
    .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999"));
  return upcoming[0] || null;
});

function onEnter(station) {
  router.push(station.to);
}

// Open to everyone, signed in or not: the queue (bubble + Causeway traffic) and how many tales are new.
async function loadPublic() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [cong, congBack, posts] = await Promise.allSettled([
    api.get("/checkpoints/woodlands/congestion", { params: { direction: "to_jb" } }),
    api.get("/checkpoints/woodlands/congestion", { params: { direction: "to_sg" } }),
    api.get("/posts", { params: { limit: 50 } }),
  ]);
  if (cong.status === "fulfilled") {
    subtitles.watcher = `Woodlands now: ${cong.value.data.selected.level}`;
    traffic.toJb = cong.value.data.selected.score;
  }
  if (congBack.status === "fulfilled") traffic.toSg = congBack.value.data.selected.score;
  if (posts.status === "fulfilled") {
    const n = posts.value.data.items.filter((p) => p.created_at > weekAgo).length;
    subtitles.tales = n ? `${n} new tale${n === 1 ? "" : "s"} this week` : "Be the first to share";
  }
}

// Only for you: trips, archives, balances, crew.
async function loadPrivate() {
  await trips.fetch().catch(() => {});
  const [arch, bal, mates] = await Promise.allSettled([
    api.get("/archives"),
    trips.defaultTrip ? api.get(`/trips/${trips.defaultTrip.id}/balances`) : Promise.reject(),
    api.get("/auth/crew"),
  ]);
  if (arch.status === "fulfilled") {
    const { totalTrips, years } = arch.value.data;
    subtitles.archives = totalTrips ? `${totalTrips} trips in ${years.length} year${years.length === 1 ? "" : "s"}` : "Empty for now";
  }
  if (bal.status === "fulfilled") {
    const summary = bal.value.data.mySummary;
    subtitles.ledger = summary[0] || `All square · ${sgd(bal.value.data.totalSpent)} spent`;
  }
  if (mates.status === "fulfilled") {
    crew.value = mates.value.data;
    const tripIds = [...new Set(trips.trips.filter((t) => t.phase !== "archived").map((t) => t.id))];
    presence.start(me.value, tripIds);
  }
}

onMounted(() => {
  loadPublic();
  if (auth.user) loadPrivate();
});
</script>

<template>
  <component :is="preview ? 'div' : 'main'" class="basecamp" :class=" { night: isNight, preview }">
  <h1 v-if="!preview" class="sr-only">{{ auth.firstName ? `${auth.firstName}'s` : "Your" }} basecamp</h1>

    <CampScene
      :me="me"
      :crew="offlineCrew"
      :live="presence.online"
      :subtitles="subtitles"
      :mode="mode"
      :condition="condition"
      :return-from="returnFrom"
      :traffic="traffic"
      :locked="locked"
      :view-shift="viewShift"
      @locked="onLocked"
      @enter="onEnter"
      @move="presence.send"
      @wave="presence.wave"
    >
      <div class="hud top-right">
        <span v-if="forecast || forced" class="chip-weather" :title="forecast">
          Woodlands · {{ conditionLabel }}
        </span>

        <button
          type="button"
          class="round"
          :aria-pressed="music.on.value"
          :aria-label="music.on.value ? 'Turn music off' : 'Turn music on'"
          :title="music.on.value ? 'Music on' : 'Music off'"
          @click="music.toggle"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9Z" class="fill" />
            <template v-if="music.on.value">
              <path d="M16.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 6a8.5 8.5 0 0 1 0 12" />
            </template>
            <path v-else d="M16 9l5 6M21 9l-5 6" />
          </svg>
        </button>

        <button type="button" class="round" :aria-label="`${modeLabel}. Change sky`" :title="modeLabel" @click="cycleMode">
          <!-- auto: half sun/half moon; day: sun; night: moon -->
          <svg v-if="mode === 'day'" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </svg>
          <svg v-else-if="mode === 'night'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16Z" class="fill" />
          </svg>
        </button>
      </div>

      <RouterLink v-if="nextTrip" :to="`/planner/${nextTrip.id}`" class="hud card next-trip">
        <span class="eyebrow-camp">{{ nextTrip.phase === "on_the_road" ? "On the road" : "Next trip" }}</span>
        <strong>{{ nextTrip.name }}</strong>
        <span>{{ nextTrip.start_date ? shortDate(nextTrip.start_date) : "No date yet" }}</span>
      </RouterLink>
      <RouterLink v-else-if="!auth.user && !preview" to="/sign-in" class="hud card next-trip">        
        <span class="eyebrow-camp">Welcome, traveller</span>
        <strong>Sign in to pitch your tent</strong>
        <span>Your crew will show up here</span>
      </RouterLink>

      <div class="hud bottom-right card help">
        <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or tap to walk</p>
        <p><kbd>E</kbd> go in · <kbd>Q</kbd> wave</p>
        <p v-if="onlineCount" class="online"><i class="dot" />{{ onlineCount }} crewmate{{ onlineCount === 1 ? "" : "s" }} at camp</p>
      </div>
    </CampScene>
  </component>
</template>

<style scoped>
.basecamp {
  position: relative;
  flex: 1;
  min-height: 520px;
  font-family: var(--font-round);
  color: #1f2a24;
}
.basecamp > :deep(.camp) {
  position: absolute;
  inset: 0;
}
.hud {
  position: absolute;
  z-index: 2;
}
.top-right {
  top: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.round {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 2.5px solid #1f2a24;
  border-radius: 50%;
  background: #fffdf7;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  cursor: pointer;
}
.round svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: #1f2a24;
  stroke-width: 2;
  stroke-linecap: round;
}
.round .fill {
  fill: #1f2a24;
}
.night .round {
  background: #23305a;
  border-color: #0f1b2d;
}
.night .round svg {
  stroke: #fff6d8;
}
.night .round .fill {
  fill: #fff6d8;
}
.chip-weather {
  padding: 6px 12px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  font-size: 13px;
  font-weight: 600;
}
.card {
  border: 2.5px solid #1f2a24;
  border-radius: 16px;
  background: #fffdf7;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.2);
}
.next-trip {
  left: 18px;
  bottom: 18px;
  display: grid;
  gap: 2px;
  padding: 12px 18px 14px;
  min-width: 170px;
  max-width: 260px;
  color: #1f2a24;
  text-decoration: none;
  transition: translate 0.15s;
}
.next-trip:hover {
  translate: 0 -2px;
  color: #1f2a24;
}
.next-trip strong {
  font-size: 21px;
  line-height: 1.1;
}
.next-trip span:last-child {
  font-size: 14px;
  opacity: 0.8;
}
.eyebrow-camp {
  font-size: 12.5px;
  font-weight: 700;
  color: #2e6b46;
}
.help {
  right: 18px;
  bottom: 18px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
}
.help p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.9;
}
kbd {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 5px;
  background: #1f2a24;
  color: #fffdf7;
  font: inherit;
  font-size: 12px;
}
.online {
  color: #2e6b46;
}
.dot {
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 50%;
  background: #3fbf6a;
}
/* phones: Pocket Camp-style corners, so nothing sits on top of the "Enter …" button at the bottom */
.preview .help {
  right: auto;
  left: 18px;
}

@media (max-width: 640px) {
  .top-right {
    top: 12px;
    right: 12px;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  .top-right .round {
    order: -1; /* the sky button stays in the corner, the weather chip tucks under it */
  }
  .chip-weather {
    font-size: 12px;
    padding: 4px 10px;
  }
  .next-trip {
    top: 12px;
    left: 12px;
    bottom: auto;
    min-width: 0;
    max-width: 55%;
    padding: 8px 12px 9px;
    border-radius: 14px;
  }
  .next-trip strong {
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .next-trip span:last-child {
    font-size: 12px;
  }
  .eyebrow-camp {
    font-size: 11px;
  }
}
@media (max-width: 700px), (pointer: coarse) {
  .help p:not(.online) {
    display: none;
  }
  .help:not(:has(.online)) {
    display: none;
  }
}
</style>
