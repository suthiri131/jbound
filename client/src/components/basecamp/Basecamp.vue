<script setup>
/**
 * The Basecamp house. Pure SVG art + four RouterLink doors positioned on top
 * (percentages of the 1000×720 artboard). Doors swing open on hover/focus.
 * Props carry the live one-liners shown on each door's plaque.
 */
defineProps({
  watcherSub: { type: String, default: "Check the queue" },
  talesSub: { type: String, default: "Read and share reviews" },
  ledgerSub: { type: String, default: "Split costs in S$ and RM" },
  archivesSub: { type: String, default: "Past trip scrapbooks" },
});
</script>

<template>
  <div class="house">
    <svg viewBox="0 0 1000 720" aria-hidden="true" class="art">
      <rect width="1000" height="720" fill="#E9DDBF" />
      <circle cx="140" cy="118" r="48" fill="#E0A43B" />
      <path
        d="M250 120q10-10 20 0q10-10 20 0M310 90q8-8 16 0q8-8 16 0M820 150q9-9 18 0q9-9 18 0"
        fill="none"
        stroke="#2A2117"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M0 500C140 430 300 470 430 440S720 400 1000 460V720H0Z"
        fill="#CBD5B0"
      />
      <path
        d="M0 560C180 520 320 560 520 540S820 520 1000 560V720H0Z"
        fill="#B5C495"
      />
      <!-- tree -->
      <rect
        x="58"
        y="520"
        width="22"
        height="168"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="40"
        cy="520"
        r="42"
        fill="#2E5A3C"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="104"
        cy="512"
        r="44"
        fill="#2E5A3C"
        stroke="#2A2117"
        stroke-width="3"
      />
      <circle
        cx="70"
        cy="470"
        r="58"
        fill="#3B6E49"
        stroke="#2A2117"
        stroke-width="3"
      />
      <!-- chimney + smoke -->
      <circle class="smoke" cx="722" cy="128" r="16" fill="#D9CDB2" />
      <circle class="smoke s2" cx="722" cy="128" r="16" fill="#D9CDB2" />
      <circle class="smoke s3" cx="722" cy="128" r="16" fill="#D9CDB2" />
      <rect
        x="692"
        y="150"
        width="60"
        height="160"
        fill="#9E3B1B"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path
        d="M692 180h60M692 210h60M692 240h60M712 150v30M732 180v30M712 210v30"
        stroke="#7A2D14"
        stroke-width="2"
      />
      <rect x="684" y="138" width="76" height="16" fill="#2A2117" />
      <!-- ground floor -->
      <rect
        x="130"
        y="430"
        width="740"
        height="256"
        fill="#E4C796"
        stroke="#2A2117"
        stroke-width="5"
      />
      <path
        d="M132 470H868M132 510H868M132 550H868M132 590H868M132 630H868M132 670H868"
        stroke="#C9A46A"
        stroke-width="2"
      />
      <!-- roof -->
      <polygon
        points="66,442 500,68 934,442"
        fill="#B4471F"
        stroke="#2A2117"
        stroke-width="5"
        stroke-linejoin="round"
      />
      <path
        d="M407 150H593M337 210H663M268 270H732M198 330H802M128 390H872"
        stroke="#8E3718"
        stroke-width="3"
        stroke-dasharray="18 10"
      />
      <polygon
        points="170,432 500,145 830,432"
        fill="#D9B37E"
        stroke="#2A2117"
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M436 200H564M390 240H610M344 280H656M297 320H703M251 360H749M205 400H795"
        stroke="#B58B55"
        stroke-width="2"
      />
      <!-- attic windows -->
      <circle
        cx="372"
        cy="360"
        r="24"
        fill="#F6E2B3"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path d="M372 336v48M348 360h48" stroke="#2A2117" stroke-width="3" />
      <circle
        cx="628"
        cy="360"
        r="24"
        fill="#F6E2B3"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path d="M628 336v48M604 360h48" stroke="#2A2117" stroke-width="3" />

      <!-- attic door frame, ledge, rope ladder -->
      <path d="M444 412V312A56 48 0 0 1 556 312V412Z" fill="#2A2117" />
      <rect x="120" y="428" width="760" height="14" fill="#2A2117" />
      <rect
        x="420"
        y="410"
        width="160"
        height="12"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
      <!-- ground windows + flower boxes -->
      <rect
        x="345"
        y="520"
        width="60"
        height="64"
        fill="#F6E2B3"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path d="M375 520v64M345 552h60" stroke="#2A2117" stroke-width="3" />
      <rect
        x="338"
        y="586"
        width="74"
        height="14"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
      <rect
        x="595"
        y="520"
        width="60"
        height="64"
        fill="#F6E2B3"
        stroke="#2A2117"
        stroke-width="4"
      />
      <path d="M625 520v64M595 552h60" stroke="#2A2117" stroke-width="3" />
      <rect
        x="588"
        y="586"
        width="74"
        height="14"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
      <!-- door frames -->
      <rect 
        x="168" 
        y="484" 
        width="164" 
        height="200" 
        fill="#2A2117" 
      />
      <path 
        d="M418 684V546A82 64 0 0 1 582 546V684Z" 
        fill="#2A2117" 
      />
      <rect 
        x="668" 
        y="484" 
        width="164" 
        height="200" 
        fill="#2A2117" 
      />

      <!-- signpost pole -->
      <rect
        x="936"
        y="548"
        width="12"
        height="146"
        fill="#6B4A2B"
        stroke="#2A2117"
        stroke-width="3"
      />
    </svg>


    <!-- Doors to different pages -->

    <!-- Left door: Border Watcher -->
    <RouterLink to="/watcher" class="door" :aria-label="`Watcher: border congestion. ${watcherSub}`" style="left: 17.5%; top: 61.67%; width: 15%; height: 32.78%" data-cy="door-watcher">
      <span class="plaque watcher-plaque" style="height: 15.3%"><span class="plaque-title">Border Watcher</span><span class="plaque-sub">{{ watcherSub }}</span></span>
      <span class="door-frame" style="height: 80.5%">
        <svg viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <!-- Glow behind the door -->
          <rect width="150" height="190" fill="#1A140E" />
          <rect class="glow" width="150" height="190" fill="#E0A43B" />
          <path class="glow" d="M0 190 40 120H110L150 190Z" fill="#F6E2B3" />
        </svg>
        <!-- Design of watcher door -->
        <svg class="door-leaf" viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <rect width="150" height="190" fill="#1F4E5A" stroke="#2A2117" stroke-width="4" />
          <rect x="12" y="12" width="126" height="166" fill="none" stroke="#163A43" stroke-width="4" />
          <g fill="#CFE0C3"><circle cx="20" cy="20" r="2.6" /><circle cx="130" cy="20" r="2.6" /><circle cx="20" cy="95" r="2.6" /><circle cx="130" cy="95" r="2.6" /><circle cx="20" cy="170" r="2.6" /><circle cx="130" cy="170" r="2.6" /></g>

          <!-- Binocular-eyes -->
          <circle cx="54" cy="58" r="21" fill="#CFE0D9" stroke="#2A2117" stroke-width="4" />
          <circle cx="96" cy="58" r="21" fill="#CFE0D9" stroke="#2A2117" stroke-width="4" />
          <rect x="68" y="52" width="14" height="12" fill="#2A2117" />

          <!-- Traffic light -->
          <path d="M44 50a12 12 0 0 1 10-6M86 50a12 12 0 0 1 10-6" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
          <rect x="58" y="100" width="34" height="64" rx="8" fill="#2A2117" />
          <circle cx="75" cy="114" r="7" fill="#5A2A1A" />
          <circle cx="75" cy="132" r="7" fill="#E0A43B" />
          <circle cx="75" cy="150" r="7" fill="#4E5E40" />
          <rect x="120" y="96" width="9" height="28" rx="3" fill="#E0A43B" stroke="#2A2117" stroke-width="2" />
        </svg>
      </span>
    </RouterLink>

    <!-- Middle door: Campfire Tales -->
    <RouterLink to="/tales" class="door" :aria-label="`Tales: read and share reviews. ${talesSub}`" style="left: 42.5%; top: 61.67%; width: 15%; height: 32.78%" data-cy="door-tales">
      <span class="plaque" style="height: 15.3%"><span class="plaque-title">Tales</span><span class="plaque-sub">{{ talesSub }}</span></span>
      <span class="door-frame" style="height: 80.5%">

        <!-- Glow behind door -->
        <svg viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 190V64A75 62 0 0 1 150 64V190Z" fill="#1A140E" />
          <path class="glow" d="M0 190V64A75 62 0 0 1 150 64V190Z" fill="#E0A43B" />
          <path class="glow" d="M0 190 40 120H110L150 190Z" fill="#F6E2B3" />
          <path class="glow" d="M75 176c-18-10-22-26-10-44 2 10 8 14 12 14 0-12 4-20 12-28 4 16 14 24 10 42-2 10-12 16-24 16Z" fill="#B4471F" />
        </svg>

        <!-- Door design -->
        <svg class="door-leaf" viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 190V64A75 62 0 0 1 150 64V190Z" fill="#B4471F" stroke="#2A2117" stroke-width="4" />
          <path d="M37.5 12V190M75 2V190M112.5 12V190" stroke="#8E3718" stroke-width="3" />
          <rect x="0" y="80" width="64" height="9" fill="#2A2117" />
          <rect x="0" y="150" width="64" height="9" fill="#2A2117" />
          <path d="M52 76V52A23 20 0 0 1 98 52V76Z" fill="#E0A43B" stroke="#2A2117" stroke-width="3" />
          <path d="M75 74c-8-5-10-12-5-20 1 5 4 7 6 7 0-6 2-10 6-13 2 8 6 11 4 19-1 5-5 7-11 7Z" fill="#B4471F" />
          <path d="M64 104v12a11 11 0 0 0 22 0v-12" fill="none" stroke="#CDB98E" stroke-width="5" stroke-linecap="round" />
          <circle cx="128" cy="126" r="6" fill="#E0A43B" stroke="#2A2117" stroke-width="2" />
        </svg>
      </span>
    </RouterLink>


    <!-- Right door: Expense Ledger -->
    <RouterLink to="/ledger" class="door" :aria-label="`Ledger: split costs in Singapore dollars and ringgit. ${ledgerSub}`" style="left: 67.5%; top: 61.67%; width: 15%; height: 32.78%" data-cy="door-ledger">
      <span class="plaque" style="height: 15.3%"><span class="plaque-title">Ledger</span><span class="plaque-sub">{{ ledgerSub }}</span></span>
      <span class="door-frame" style="height: 80.5%">
        <svg viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <rect width="150" height="190" fill="#1A140E" />
          <rect class="glow" width="150" height="190" fill="#E0A43B" />
          <path class="glow" d="M0 190 40 120H110L150 190Z" fill="#F6E2B3" />
          <g class="glow" fill="#F6E2B3" stroke="#8A6A3B" stroke-width="2"><rect x="20" y="130" width="40" height="34" /><rect x="66" y="140" width="34" height="24" /><rect x="40" y="104" width="30" height="26" /></g>
        </svg>
        <svg class="door-leaf" viewBox="0 0 150 190" preserveAspectRatio="none" aria-hidden="true">
          <rect width="150" height="190" fill="#E0A43B" stroke="#2A2117" stroke-width="4" />
          <rect x="12" y="12" width="126" height="72" fill="none" stroke="#B5832A" stroke-width="4" />
          <rect x="0" y="90" width="150" height="10" fill="#8A6A3B" stroke="#2A2117" stroke-width="2" />
          <rect x="12" y="108" width="126" height="70" fill="none" stroke="#8A6A3B" stroke-width="5" />
          <path d="M14 110 136 176M136 110 14 176" stroke="#8A6A3B" stroke-width="5" />
          <path d="M56 22 46 40M94 22 104 40M56 22H94" stroke="#2A2117" stroke-width="2" />
          <circle cx="75" cy="20" r="3" fill="#2A2117" />
          <rect x="25" y="40" width="100" height="32" rx="3" fill="#FBF6E9" stroke="#2A2117" stroke-width="2.5" />
          <text x="75" y="62" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="15" fill="#2A2117">SGD ⇄ RM</text>
          <circle cx="128" cy="124" r="6" fill="#2A2117" />
        </svg>
      </span>
    </RouterLink>

    <!-- Attic door: Archives -->
    <RouterLink to="/archives" class="door" :aria-label="`Archives in the attic: ${archivesSub}`" style="left: 45%; top: 31.25%; width: 10%; height: 25.69%" data-cy="door-archives">
      <span class="plaque" style="height: 20%; left: -32%; right: -32%"><span class="plaque-title">Archives</span><span class="plaque-sub">{{ archivesSub }}</span></span>
      <span class="door-frame" style="height: 75.7%">
        <svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 140V46A50 42 0 0 1 100 46V140Z" fill="#1A140E" />
          <path class="glow" d="M0 140V46A50 42 0 0 1 100 46V140Z" fill="#E0A43B" />
          <g class="glow"><rect x="22" y="96" width="56" height="32" rx="3" fill="#8A6A3B" stroke="#2A2117" stroke-width="2" /><rect x="22" y="96" width="56" height="10" fill="#6B4A2B" /><circle cx="50" cy="112" r="4" fill="#E0A43B" /></g>
        </svg>
        <svg class="door-leaf" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 140V46A50 42 0 0 1 100 46V140Z" fill="#6B4A2B" stroke="#2A2117" stroke-width="4" />
          <path d="M25 10V140M50 4V140M75 10V140" stroke="#523820" stroke-width="2.5" />
          <rect x="0" y="44" width="100" height="9" fill="#2A2117" />
          <rect x="0" y="104" width="100" height="9" fill="#2A2117" />
          <g fill="#CDB98E"><circle cx="10" cy="48.5" r="2" /><circle cx="90" cy="48.5" r="2" /><circle cx="10" cy="108.5" r="2" /><circle cx="90" cy="108.5" r="2" /></g>
          <circle cx="50" cy="76" r="8" fill="#2A2117" />
          <path d="M45 78h10l3 14H42Z" fill="#2A2117" />
          <path d="M16 34 30 20M16 34 26 14M16 34 34 28M20 28q4-1 5-5M23 32q5-1 7-6" fill="none" stroke="#EADFC2" stroke-width="1.3" />
        </svg>
      </span>
    </RouterLink>

    <!-- SIGNPOST → Explorer -->
    <RouterLink to="/explorer" class="sign" style="left: 86.4%; top: 79%; width: 13.2%; height: 4.4%">Explorer →</RouterLink>

  </div>
</template>

<style scoped>
.house {
  position: relative;
  width: 100%;
  aspect-ratio: 1000 / 720;
  container-type: inline-size;
}
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.door {
  position: absolute;
  display: block;
  text-decoration: none;
  color: var(--ink);
}
.door:focus-visible {
  outline: 4px solid var(--mustard);
  outline-offset: 4px;
  border-radius: 6px;
}
.plaque {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 2px solid var(--ink);
  border-radius: 5px;
  box-shadow: 2px 2px 0 var(--ink);
  text-align: center;
  white-space: nowrap;
  line-height: 1.1;
  transition: transform 0.2s;
}
.watcher-plaque {
  padding: 0.3cqw 0.6cqw;
}
.plaque-title {
  font-family: var(--font-display);
  font-size: clamp(8px, 1.6cqw, 18px);
}
.plaque-sub {
  font-weight: 700;
  font-size: clamp(6px, 1.02cqw, 12px);
  color: var(--ink-soft);
  margin-top: 0.2em;
}
.door:hover .plaque,
.door:focus-visible .plaque {
  transform: translateY(-3px) rotate(-1.5deg);
}
.door-frame {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  perspective: 700px;
}
.door-frame svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.door-leaf {
  transform-origin: left center;
  transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.35, 1);
}
.door:hover .door-leaf,
.door:focus-visible .door-leaf {
  transform: rotateY(-48deg);
}
.glow {
  opacity: 0;
  transition: opacity 0.3s;
}
.door:hover .glow,
.door:focus-visible .glow {
  opacity: 1;
}

.sign {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--jungle);
  color: var(--card);
  border: 2px solid var(--ink);
  border-radius: 3px;
  font-weight: 800;
  font-size: clamp(6px, 1.15cqw, 13px);
  text-decoration: none;
  white-space: nowrap;
  clip-path: polygon(0 0, 89% 0, 100% 50%, 89% 100%, 0 100%);
  transition: transform 0.2s;
}
.sign:hover,
.sign:focus-visible {
  color: var(--card);
  transform: translateX(4px);
}

.smoke {
  transform-box: fill-box;
  transform-origin: center;
  animation: rise 4.2s ease-out infinite;
  opacity: 0;
}
.s2 {
  animation-delay: 1.4s;
}
.s3 {
  animation-delay: 2.8s;
}
@keyframes rise {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.5);
  }
  20% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: translate(34px, -96px) scale(1.9);
  }
}
</style>
