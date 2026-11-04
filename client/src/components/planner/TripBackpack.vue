<script setup>
import { computed, useId } from "vue";
import { PHASE_STAMP } from "@/utils/constants";
import { dateRange } from "@/utils/format";

const props = defineProps({
  trip: { type: Object, default: null },
  isNew: { type: Boolean, default: false },
});

const uid = useId();
const ids = { hand: `bag-hand-${uid}`, soft: `bag-soft-${uid}` };
const handFilter = computed(() =>
  props.isNew ? undefined : `url(#${ids.hand})`,
);
const softFilter = `url(#${ids.soft})`;

const KINDS = ["rucksack", "daypack", "messenger", "tote", "satchel"];
const seed = computed(() => {
  const id = String(props.trip?.id ?? "");
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
});
const variant = computed(() =>
  props.isNew ? "tote" : KINDS[seed.value % KINDS.length],
);

// the trip's cover colour, softened into the watercolour palette (unknown colours are just lightened)
const SOFT = {
  "#2e5a3c": "#7d9a52", // green  -> moss
  "#b4471f": "#c9673e", // red    -> rust orange
  "#1f4e5a": "#8f9fcb", // teal   -> periwinkle
  "#8a5a2b": "#a4643a", // brown  -> saddle leather
  "#5a3e6b": "#a184b4", // purple -> lilac
};
const colour = computed(() => {
  const c = String(props.trip?.cover_color || "#2e5a3c").toLowerCase();
  return SOFT[c] || `color-mix(in srgb, ${c} 72%, #f3e3bd)`;
});

// where the name label and the status tag sit on each bag, in px of the 260 x 300 drawing
const SPOT = {
  rucksack: { label: [114, 224, 98, 32], tag: [21, 111] },
  daypack: { label: [114, 100, 88, 32], tag: [177, 21] },
  messenger: { label: [92, 140, 100, 32], tag: [13, 210] },
  tote: { label: [84, 176, 100, 36], tag: [21, 75] },
  satchel: { label: [84, 140, 98, 34], tag: [10, 93] },
};
const labelBox = computed(() => {
  const [x, y, w, h] = SPOT[variant.value].label;
  return {
    left: `${(x / 260) * 100}%`,
    top: `${(y / 300) * 100}%`,
    width: `${(w / 260) * 100}%`,
    height: `${(h / 300) * 100}%`,
  };
});
const tagBox = computed(() => {
  const [x, y] = SPOT[variant.value].tag;
  return { left: `${(x / 260) * 100}%`, top: `${(y / 300) * 100}%` };
});

const stamp = computed(
  () => PHASE_STAMP[props.trip?.phase] || PHASE_STAMP.planning,
);
const progress = computed(() => {
  const t = props.trip;
  if (!t) return "";
  if (t.phase === "memory_box")
    return `${t.daysLeft} day${t.daysLeft === 1 ? "" : "s"} to add photos`;
  return `${t.doneCount ?? 0} of ${t.stopCount ?? 0} ticked`;
});
</script>

<template>
  <div
    class="pack"
    :class="[`is-${variant}`, { new: isNew }]"
    :style="{ '--bag': colour }"
  >
    <div class="bag">
      <svg viewBox="0 0 260 300" aria-hidden="true">
        <defs>
          <filter :id="ids.hand" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.03"
              numOctaves="2"
              seed="4"
              result="n1"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n1"
              scale="3.2"
              xChannelSelector="R"
              yChannelSelector="G"
              result="wob"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="3"
              seed="11"
              result="n2"
            />
            <feColorMatrix
              in="n2"
              type="matrix"
              values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.02  1.1 0 0 0 -0.5"
              result="blot"
            />
            <feComposite in="blot" in2="wob" operator="in" result="blotIn" />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022"
              numOctaves="2"
              seed="21"
              result="n3"
            />
            <feColorMatrix
              in="n3"
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.88  0.5 0 0 0 -0.3"
              result="lite"
            />
            <feComposite in="lite" in2="wob" operator="in" result="liteIn" />
            <feMerge>
              <feMergeNode in="wob" />
              <feMergeNode in="blotIn" />
              <feMergeNode in="liteIn" />
            </feMerge>
          </filter>
          <filter :id="ids.soft"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>

        <!-- rucksack -->
        <g v-if="variant === 'rucksack'">
          <ellipse class="ground" cx="138" cy="284" rx="96" ry="10" />
          <g :filter="handFilter">
            <path class="strap-ink" d="M76 100 C40 120 34 190 56 262" />
            <path class="strap st-deep" d="M76 100 C40 120 34 190 56 262" />
            <!-- bedroll -->
            <rect
              class="s"
              x="40"
              y="48"
              width="176"
              height="46"
              rx="23"
              style="fill: #6f92c8"
            />
            <path
              class="thin"
              d="M70 50 L70 92 M190 50 L190 92"
              style="stroke: rgba(30, 40, 80, 0.35)"
            />
            <ellipse
              class="s"
              cx="44"
              cy="71"
              rx="14"
              ry="23"
              style="fill: #8eaee0"
            />
            <path
              class="thin"
              d="M44 71 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 6 a9 9 0 1 1 -9 -9 a12 12 0 1 1 12 12"
              style="stroke: #3e5f97"
            />
            <rect
              class="s f-leather"
              x="80"
              y="44"
              width="16"
              height="54"
              rx="4"
            />
            <rect
              class="s f-leather"
              x="176"
              y="44"
              width="16"
              height="54"
              rx="4"
            />
            <!-- handle -->
            <path class="strap-ink" d="M118 70 C116 34 158 32 160 68" />
            <path class="strap st-side" d="M118 70 C116 34 158 32 160 68" />
            <!-- side panel + side pocket -->
            <path
              class="s f-side"
              d="M58 104 C58 86 66 78 82 76 L88 266 C72 266 60 258 58 246 Z"
            />
            <path
              class="s f-deep"
              d="M58 196 C66 190 78 188 86 190 L88 266 C72 266 60 258 58 246 Z"
            />
            <rect
              class="s f-leather"
              x="66"
              y="196"
              width="12"
              height="22"
              rx="3"
            />
            <!-- body -->
            <path
              class="s f-bag"
              d="M82 76 C82 66 90 60 102 60 L200 60 C216 60 226 72 226 88 L230 248 C230 258 222 266 210 266 L88 266 Z"
            />
            <path
              class="shade"
              :filter="softFilter"
              d="M204 70 C220 80 224 120 224 160 L226 250 C218 258 210 258 204 254 Z"
            />
            <!-- top flap -->
            <path
              class="s f-side"
              d="M78 70 C82 58 94 54 106 54 L200 54 C218 54 230 66 230 84 L228 134 C200 148 112 150 82 138 Z"
            />
            <path
              class="stitch"
              d="M90 72 C94 64 102 62 110 62 L198 62 C212 62 220 72 220 86 L219 126 C196 136 116 138 92 130"
            />
            <path class="shine" d="M100 84 C110 74 130 70 150 70" />
            <!-- leather straps on the flap -->
            <rect
              class="s f-leather"
              x="110"
              y="118"
              width="18"
              height="50"
              rx="4"
            />
            <rect
              class="s f-leather"
              x="148"
              y="122"
              width="18"
              height="48"
              rx="4"
            />
            <rect
              class="s f-leather"
              x="186"
              y="118"
              width="18"
              height="50"
              rx="4"
            />
            <rect
              class="s f-buckle"
              x="107"
              y="150"
              width="24"
              height="10"
              rx="2"
            />
            <rect
              class="s f-buckle"
              x="145"
              y="152"
              width="24"
              height="10"
              rx="2"
            />
            <rect
              class="s f-buckle"
              x="183"
              y="150"
              width="24"
              height="10"
              rx="2"
            />
            <!-- front pocket -->
            <path
              class="s f-bag2"
              d="M98 192 C98 184 104 180 112 180 L212 180 C222 180 228 186 228 196 L228 248 C228 256 222 262 212 262 L112 262 C104 262 98 256 98 248 Z"
            />
            <path
              class="s f-side"
              d="M96 186 C96 180 102 176 110 176 L214 176 C224 176 230 182 230 192 L230 210 C196 220 130 220 96 210 Z"
            />
            <rect
              class="s f-leather"
              x="124"
              y="200"
              width="14"
              height="22"
              rx="3"
            />
            <rect
              class="s f-leather"
              x="188"
              y="200"
              width="14"
              height="22"
              rx="3"
            />
            <rect
              class="s label"
              x="114"
              y="224"
              width="98"
              height="32"
              rx="5"
            />
            <path class="stitch dk" d="M118 228 H208 V252 H118 Z" />
            <!-- carabiner -->
            <ellipse
              cx="90"
              cy="92"
              rx="7"
              ry="13"
              fill="none"
              stroke="#3a2618"
              stroke-width="6"
            />
            <ellipse
              cx="90"
              cy="92"
              rx="7"
              ry="13"
              fill="none"
              stroke="#c9d0d6"
              stroke-width="3"
            />
          </g>
          <path class="string tie" d="M90 104 C80 118 52 116 30 122" />
        </g>

        <!-- daypack -->
        <g v-else-if="variant === 'daypack'">
          <ellipse class="ground" cx="136" cy="286" rx="94" ry="10" />
          <g :filter="handFilter">
            <path class="strap-ink" d="M86 70 C40 86 34 180 54 254" />
            <path class="strap st-side" d="M86 70 C40 86 34 180 54 254" />
            <path class="strap-ink" d="M116 48 C114 14 152 12 152 46" />
            <path
              class="strap"
              d="M116 48 C114 14 152 12 152 46"
              style="stroke: #6f6a8f"
            />
            <!-- side panel -->
            <path
              class="s f-side"
              d="M62 96 C64 74 76 62 94 58 L98 272 C80 272 66 266 62 252 Z"
            />
            <!-- bottle -->
            <rect
              class="s"
              x="46"
              y="154"
              width="32"
              height="70"
              rx="11"
              style="fill: #86cbe2"
            />
            <rect
              class="s"
              x="53"
              y="140"
              width="18"
              height="16"
              rx="3"
              style="fill: #4f90b8"
            />
            <path class="thin" d="M48 184 H76" style="stroke: #3a7fa8" />
            <path
              class="shine"
              d="M54 166 V196"
              style="stroke: rgba(255, 255, 255, 0.6); stroke-width: 4"
            />
            <!-- mesh pocket over the bottle -->
            <path
              class="s f-side"
              d="M48 196 C60 190 80 188 96 190 L98 272 C78 272 58 264 52 250 Z"
            />
            <path
              class="thin"
              d="M58 206 L94 202 M56 222 L96 218 M58 238 L96 234"
              style="stroke: rgba(42, 22, 8, 0.35)"
            />
            <!-- body -->
            <path
              class="s f-bag"
              d="M94 58 C102 48 118 42 136 42 L172 42 C198 42 216 58 218 84 L222 252 C222 264 214 272 202 272 L98 272 Z"
            />
            <path
              class="shade"
              :filter="softFilter"
              d="M200 52 C214 66 218 100 218 140 L220 256 C212 262 204 262 198 258 Z"
            />
            <path
              class="ink"
              d="M104 66 C112 56 124 52 138 52 L170 52 C192 52 206 64 208 84"
            />
            <!-- top pocket zips -->
            <path class="ink" d="M108 84 C140 79 180 79 210 86" />
            <path class="ink" d="M110 92 C140 87 180 87 210 94" />
            <path
              class="thin"
              d="M112 88 C140 83 180 83 208 90"
              style="stroke-dasharray: 2 2.5"
            />
            <rect
              class="s label"
              x="114"
              y="100"
              width="88"
              height="32"
              rx="5"
            />
            <path class="stitch dk" d="M118 104 H198 V128 H118 Z" />
            <!-- compression straps + buckles -->
            <path
              class="s"
              d="M56 126 L120 122 L120 134 L56 138 Z"
              style="fill: #6f6a8f"
            />
            <rect
              class="s"
              x="90"
              y="120"
              width="18"
              height="16"
              rx="3"
              style="fill: #a8683e"
            />
            <path
              class="s"
              d="M52 218 L100 214 L100 226 L52 230 Z"
              style="fill: #6f6a8f"
            />
            <rect
              class="s"
              x="74"
              y="212"
              width="18"
              height="16"
              rx="3"
              style="fill: #a8683e"
            />
            <path
              class="s"
              d="M212 120 L232 118 L232 132 L212 134 Z"
              style="fill: #6f6a8f"
            />
            <rect
              class="s"
              x="218"
              y="116"
              width="14"
              height="18"
              rx="3"
              style="fill: #a8683e"
            />
            <!-- front pocket -->
            <path
              class="s f-bag"
              d="M108 152 C108 144 114 138 122 138 L206 136 C214 136 220 142 220 150 L222 252 C222 260 216 266 208 266 L122 268 C114 268 108 262 108 254 Z"
            />
            <path class="ink" d="M160 142 L160 262" />
            <path class="ink" d="M168 142 L168 262" />
            <path
              class="thin"
              d="M164 144 L164 260"
              style="stroke-dasharray: 2 2.5"
            />
            <path class="ink" d="M120 252 C150 256 190 256 214 252" />
            <path
              class="s"
              d="M196 214 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5Z"
              style="fill: #c8553d"
            />
            <!-- zip pulls -->
            <path
              class="s"
              d="M114 92 C106 100 106 110 114 112 C122 110 122 100 114 92Z"
              style="fill: #93b84a"
            />
            <path
              class="s"
              d="M164 150 C156 158 156 168 164 170 C172 168 172 158 164 150Z"
              style="fill: #93b84a"
            />
            <path
              class="s"
              d="M104 238 C96 246 96 256 104 258 C112 256 112 246 104 238Z"
              style="fill: #93b84a"
            />
          </g>
          <path class="string tie" d="M150 46 C160 40 170 34 178 32" />
        </g>

        <!-- messenger -->
        <g v-else-if="variant === 'messenger'">
          <ellipse class="ground" cx="138" cy="272" rx="110" ry="10" />
          <g :filter="handFilter">
            <path class="strap-ink" d="M42 128 C40 34 226 30 228 116" />
            <path class="strap st-deep" d="M42 128 C40 34 226 30 228 116" />
            <!-- gusset -->
            <path class="s f-side" d="M28 132 L54 120 L58 256 L32 248 Z" />
            <path
              class="thin"
              d="M32 160 L54 152"
              style="stroke: rgba(42, 22, 8, 0.4)"
            />
            <!-- body -->
            <path
              class="s f-bag"
              d="M52 120 C52 112 58 108 66 108 L222 102 C232 102 238 108 238 118 L240 244 C240 254 234 260 224 260 L64 264 C56 264 52 258 52 250 Z"
            />
            <path
              class="shade"
              :filter="softFilter"
              d="M60 236 C110 246 190 244 234 236 L236 254 L62 258 Z"
            />
            <!-- front pockets -->
            <path class="s f-bag2" d="M64 196 L136 194 L138 252 L66 254 Z" />
            <path class="s f-bag2" d="M156 194 L228 192 L230 250 L158 252 Z" />
            <path class="stitch dk" d="M70 202 L132 200 M162 200 L224 198" />
            <!-- flap -->
            <path
              class="s f-side"
              d="M46 116 C46 106 52 100 62 100 L224 94 C236 94 242 102 242 112 L242 182 C242 190 236 194 228 194 L64 198 C54 198 46 192 46 184 Z"
            />
            <path
              class="stitch"
              d="M56 112 C56 108 60 106 64 106 L224 100 C230 100 234 104 234 110 L234 180 C234 184 230 186 226 186 L64 190 C58 190 56 186 56 182 Z"
            />
            <path
              class="thin"
              d="M190 112 l10 10 m0 -10 l-10 10 M196 108 l10 10"
              style="stroke: rgba(42, 22, 8, 0.4)"
            />
            <!-- centre tab -->
            <rect
              class="s f-side"
              x="138"
              y="176"
              width="18"
              height="48"
              rx="4"
            />
            <circle class="s f-metal" cx="147" cy="212" r="5" />
            <!-- pins -->
            <circle class="s" cx="82" cy="134" r="17" style="fill: #c89a6a" />
            <path
              class="s"
              d="M70 136 C70 124 94 124 94 136 Z"
              style="fill: #c84a3a"
            />
            <path class="s f-cream" d="M78 136 L86 136 L86 146 L78 146 Z" />
            <circle cx="77" cy="130" r="1.8" fill="#fff" />
            <circle cx="86" cy="129" r="1.6" fill="#fff" />
            <circle class="s" cx="108" cy="120" r="8" style="fill: #c89a6a" />
            <path
              class="thin"
              d="M104 123 L108 115 L112 123 Z"
              style="fill: #5d7a8c"
            />
            <circle class="s" cx="214" cy="140" r="15" style="fill: #e7c48a" />
            <path
              class="s"
              d="M203 147 L211 133 L216 141 L219 137 L226 147 Z"
              style="fill: #7d9a52"
            />
            <path
              class="s"
              d="M208 168 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1Z"
              style="fill: #a7744a; opacity: 0.95"
            />
            <rect
              class="s label"
              x="92"
              y="140"
              width="100"
              height="32"
              rx="5"
            />
            <path class="stitch dk" d="M96 144 H188 V168 H96 Z" />
            <!-- leaves stitched on the pocket -->
            <path
              class="s"
              d="M82 246 C76 232 84 220 96 218 C98 232 92 242 82 246Z"
              style="fill: #8fb06a"
            />
            <path class="thin" d="M84 242 L94 222" />
            <path
              class="s"
              d="M100 244 C98 234 104 226 112 226 C112 236 108 242 100 244Z"
              style="fill: #a8c47c"
            />
            <!-- ring -->
            <circle
              cx="40"
              cy="130"
              r="8"
              fill="none"
              stroke="#3a2618"
              stroke-width="6"
            />
            <circle
              cx="40"
              cy="130"
              r="8"
              fill="none"
              stroke="#c9d0d6"
              stroke-width="3"
            />
          </g>
          <path class="string tie" d="M38 138 C30 160 22 190 18 214" />
        </g>

        <!-- tote -->
        <g v-else-if="variant === 'tote'">
          <ellipse class="ground" cx="136" cy="284" rx="94" ry="10" />
          <g :filter="handFilter">
            <path class="strap-ink" d="M86 124 C80 26 182 22 178 122" />
            <path
              class="strap"
              d="M86 124 C80 26 182 22 178 122"
              style="stroke: #d8c6a2"
            />
            <!-- side -->
            <path
              class="s f-side"
              d="M206 120 L222 128 L228 248 C228 258 222 264 212 266 Z"
            />
            <!-- body -->
            <path
              class="s f-bag"
              d="M56 124 C56 118 62 114 70 114 L198 110 C206 110 210 116 210 122 L216 252 C216 262 208 268 198 268 L70 270 C60 270 54 264 54 254 Z"
            />
            <path class="s f-deep" d="M60 118 L206 114 L206 122 L60 126 Z" />
            <path
              class="shade"
              :filter="softFilter"
              d="M58 140 C64 180 62 230 60 262 L74 264 C70 220 72 180 66 140 Z"
            />
            <path class="stitch dk" d="M62 136 C110 132 160 130 208 130" />
            <!-- front handle -->
            <path class="strap-ink" d="M98 128 C98 48 168 46 168 126" />
            <path
              class="strap"
              d="M98 128 C98 48 168 46 168 126"
              style="stroke: #eadcbd"
            />
            <path
              class="thin"
              d="M98 120 C98 52 168 50 168 120"
              style="stroke: rgba(42, 22, 8, 0.3); stroke-dasharray: 3 3"
            />
            <!-- hearts -->
            <g class="f-lite hearts">
              <path
                d="M78 156 c-6 -6 -14 0 -8 8 l8 8 8 -8 c6 -8 -2 -14 -8 -8Z"
              />
              <path
                d="M186 150 c-5 -5 -12 0 -7 7 l7 7 7 -7 c5 -7 -2 -12 -7 -7Z"
              />
              <path
                d="M148 146 c-4 -4 -9 0 -5 5 l5 5 5 -5 c4 -5 -1 -9 -5 -5Z"
              />
              <path
                d="M72 226 c-6 -6 -14 0 -8 8 l8 8 8 -8 c6 -8 -2 -14 -8 -8Z"
              />
              <path
                d="M114 240 c-5 -5 -12 0 -7 7 l7 7 7 -7 c5 -7 -2 -12 -7 -7Z"
              />
              <path
                d="M168 232 c-6 -6 -14 0 -8 8 l8 8 8 -8 c6 -8 -2 -14 -8 -8Z"
              />
              <path
                d="M198 206 c-5 -5 -12 0 -7 7 l7 7 7 -7 c5 -7 -2 -12 -7 -7Z"
              />
              <path
                d="M200 252 c-4 -4 -9 0 -5 5 l5 5 5 -5 c4 -5 -1 -9 -5 -5Z"
              />
              <path d="M96 146 c-3 -3 -7 0 -4 4 l4 4 4 -4 c3 -4 -1 -7 -4 -4Z" />
            </g>
            <rect
              class="s label"
              x="84"
              y="176"
              width="100"
              height="36"
              rx="5"
            />
            <path class="stitch dk" d="M88 180 H180 V208 H88 Z" />
          </g>
          <path class="string tie" d="M100 96 C80 92 60 88 42 86" />
        </g>

        <!-- satchel -->
        <g v-else>
          <ellipse class="ground" cx="134" cy="284" rx="98" ry="10" />
          <g :filter="handFilter">
            <path class="strap-ink" d="M58 156 C40 40 150 0 208 146" />
            <path class="strap st-deep" d="M58 156 C40 40 150 0 208 146" />
            <path
              class="thin"
              d="M58 150 C42 46 148 8 204 140"
              style="stroke: #f2cf8a; stroke-width: 2.4; stroke-dasharray: 1 5"
            />
            <!-- gusset with a map and sprigs poking out -->
            <path
              class="s"
              d="M214 144 L230 120 L240 132 L226 158 Z"
              style="fill: #efe1c0"
            />
            <path
              class="thin"
              d="M222 132 L232 138 M218 140 L230 146"
              style="stroke: #5d86a8"
            />
            <path
              class="s"
              d="M226 152 C222 130 236 116 248 114 C246 130 238 146 226 152Z"
              style="fill: #7c9c52"
            />
            <path
              class="s"
              d="M222 150 C228 134 244 128 252 130 C246 142 234 150 222 150Z"
              style="fill: #94b46a"
            />
            <path
              class="s f-side"
              d="M212 146 L232 156 L234 242 C234 254 226 262 216 264 Z"
            />
            <!-- body -->
            <path
              class="s f-bag"
              d="M50 152 C50 140 60 132 74 132 L192 130 C206 130 216 140 216 154 L218 248 C218 260 208 268 194 268 L72 270 C58 270 48 260 48 248 Z"
            />
            <path
              class="shade"
              :filter="softFilter"
              d="M56 230 C100 250 180 250 212 230 L212 258 L58 262 Z"
            />
            <!-- small front pocket -->
            <path class="s f-side" d="M82 214 L186 212 L184 254 L84 256 Z" />
            <path
              class="thin"
              d="M88 220 L180 218 L178 250 L90 252 Z"
              style="stroke: #f2cf8a; stroke-width: 2.2; stroke-dasharray: 1 4"
            />
            <!-- domed flap -->
            <path
              class="s f-bag2"
              d="M44 152 C44 112 90 100 132 100 C176 100 222 112 222 152 L220 202 C190 216 76 216 46 202 Z"
            />
            <path
              class="thin"
              d="M54 154 C54 120 94 110 132 110 C172 110 212 120 212 154 L211 196 C184 207 82 207 55 196 Z"
              style="stroke: #f2cf8a; stroke-width: 2.4; stroke-dasharray: 1 4"
            />
            <path class="shine" d="M74 128 C90 116 112 112 132 112" />
            <path
              class="shine"
              d="M176 120 C190 126 198 134 202 144"
              style="stroke-width: 3"
            />
            <rect
              class="s label"
              x="84"
              y="140"
              width="98"
              height="34"
              rx="5"
            />
            <path class="stitch dk" d="M88 144 H178 V170 H88 Z" />
            <!-- flower studs -->
            <circle class="s" cx="84" cy="198" r="9" style="fill: #e9b65e" />
            <path
              class="thin"
              d="M84 198 m0 -2 a2 2 0 1 1 -2 2 a4 4 0 1 1 4 4 a6 6 0 1 1 -6 -6"
              style="stroke: #8a5a20"
            />
            <circle class="s" cx="182" cy="198" r="9" style="fill: #e9b65e" />
            <path
              class="thin"
              d="M182 198 m0 -2 a2 2 0 1 1 -2 2 a4 4 0 1 1 4 4 a6 6 0 1 1 -6 -6"
              style="stroke: #8a5a20"
            />
          </g>
          <path class="string tie" d="M56 132 C46 120 34 112 22 108" />
        </g>
      </svg>

      <span v-if="isNew" class="label-text new-text" :style="labelBox">
        <span class="plus" aria-hidden="true">+</span>
        Pack a new trip
      </span>
      <template v-else>
        <span class="label-text" :style="labelBox" :title="trip.name"
          ><span class="clamp">{{ trip.name }}</span></span
        >
        <!-- status as a luggage tag tied on with string -->
        <span class="luggage" :style="{ ...tagBox, '--tag': stamp.color }">{{
          stamp.label
        }}</span>
      </template>
    </div>

    <template v-if="!isNew">
      <span class="dates">{{ dateRange(trip.start_date, trip.end_date) }}</span>
      <span class="caption hand">{{ progress }}</span>
    </template>
    <span v-else class="caption hand">or join a crew with a code</span>
  </div>
</template>

<style scoped>
.pack {
  --ink: #3a2618;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.bag {
  position: relative;
  width: 100%;
  max-width: 300px;
  aspect-ratio: 260 / 300;
  container-type: inline-size;
  transition: transform 0.22s cubic-bezier(0.3, 1.6, 0.5, 1);
  transform-origin: 50% 95%;
}
.bag svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* the drawing: warm-brown ink, watercolour fills (shades are mixed from the bag colour) */
.ink,
.s {
  stroke: var(--ink);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ink {
  fill: none;
}
.thin {
  stroke: var(--ink);
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
}
.f-bag {
  fill: var(--bag);
}
.f-bag2 {
  fill: color-mix(in srgb, var(--bag) 88%, #fff4dc);
}
.f-side {
  fill: color-mix(in srgb, var(--bag) 76%, #2a1608);
}
.f-deep {
  fill: color-mix(in srgb, var(--bag) 60%, #2a1608);
}
.f-lite {
  fill: color-mix(in srgb, var(--bag) 55%, #fff1cf);
}
.f-leather {
  fill: #9c5d34;
}
.f-leather2 {
  fill: #7d4427;
}
.f-buckle {
  fill: #d6a243;
}
.f-metal {
  fill: #cfd5da;
}
.f-cream {
  fill: #f4e7c9;
}
.f-web {
  fill: #e9dbbd;
}
.st-side {
  stroke: color-mix(in srgb, var(--bag) 76%, #2a1608);
}
.st-deep {
  stroke: color-mix(in srgb, var(--bag) 60%, #2a1608);
}
.st-lite {
  stroke: color-mix(in srgb, var(--bag) 55%, #fff1cf);
}
.strap-ink {
  fill: none;
  stroke: var(--ink);
  stroke-width: 15;
  stroke-linecap: round;
}
.strap {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}
.stitch {
  fill: none;
  stroke: rgba(255, 244, 220, 0.55);
  stroke-width: 1.6;
  stroke-dasharray: 4 3.5;
  stroke-linecap: round;
}
.stitch.dk {
  stroke: rgba(42, 22, 8, 0.45);
}
.shade {
  fill: rgba(42, 22, 8, 0.22);
}
.shine {
  fill: none;
  stroke: rgba(255, 248, 230, 0.45);
  stroke-width: 5;
  stroke-linecap: round;
}
.ground {
  fill: rgba(110, 70, 25, 0.2);
}
.label {
  fill: #f6e8c8;
}
.string {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.4;
}

/* text on top of the drawing */
.label-text {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2.3%;
  box-sizing: border-box;
  text-align: center;
  font-family: var(--font-story, Georgia, serif);
  font-weight: 800;
  font-size: clamp(10px, 5cqw, 15px);
  line-height: 1.05;
  color: var(--ink);
  rotate: -2deg;
  pointer-events: none;
}
/* long names: two lines, then … */
.clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: break-word;
}
.luggage {
  position: absolute;
  padding: 2px 8px 2px 13px;
  border: 2px solid var(--ink);
  border-radius: 3px 7px 7px 3px;
  background: var(--tag);
  color: #fbf3e2;
  font-family: var(--font-round);
  font-size: clamp(8px, 3.85cqw, 12px);
  font-weight: 700;
  letter-spacing: 0.08em;
  white-space: nowrap;
  rotate: -10deg;
  transform-origin: 0 50%;
  box-shadow: 1px 2px 0 rgba(58, 38, 24, 0.3);
}
.luggage::before {
  /* the punched hole the string goes through */
  content: "";
  position: absolute;
  left: 3px;
  top: 50%;
  width: 5px;
  height: 5px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: #fbf3e2;
  border: 1.5px solid var(--ink);
}

.dates {
  margin-top: -2px;
  font-family: var(--font-round);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5a3a22;
  text-align: center;
}
.caption {
  color: var(--ink);
  font-size: 20px;
  line-height: 1;
  text-align: center;
}

/* the "new trip" bag: an empty dashed tote waiting to be packed */
.new .s,
.new .ink {
  stroke: #9a7448;
  stroke-dasharray: 7 5;
}
.new .f-bag,
.new .f-side,
.new .f-deep,
.new .label {
  fill: rgba(255, 250, 235, 0.5);
}
.new .strap-ink {
  stroke: #9a7448;
  stroke-width: 12;
  stroke-dasharray: 7 5;
}
.new .strap {
  stroke: #f6ecd6;
}
.new .hearts,
.new .stitch,
.new .shade,
.new .thin,
.new .tie {
  display: none;
}
.new-text {
  flex-direction: column;
  font-family: var(--font-round);
  font-weight: 700;
  font-size: clamp(11px, 5.4cqw, 16px);
  color: #7a5630;
  rotate: none;
}
.plus {
  font-size: 2em;
  line-height: 0.8;
}

@media (max-width: 480px) {
  .caption {
    font-size: 17px;
  }
  .dates {
    font-size: 10px;
  }
}
</style>
