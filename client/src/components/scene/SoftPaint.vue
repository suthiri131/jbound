<template>
  <!--
    A much quieter take on the Planner backpacks' watercolour, for large pieces of scenery.
    Render once on a page, then paint a decorative layer with `filter: url(#soft-paint)`.
    Never put it on anything holding text: it nudges every pixel, so the text goes soft.
  -->
  <svg class="soft-paint" width="0" height="0" aria-hidden="true">
    <defs>
      <filter id="soft-paint" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="1" seed="4" result="n1" />
        <feDisplacementMap in="SourceGraphic" in2="n1" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="wob" />
        <!-- paint texture only on the solid pieces, not in their soft shadows -->
        <feColorMatrix in="wob" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -11" result="solid" />
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="4" seed="11" result="n2" />
        <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.02  0.2 0 0 0 -0.09" result="blot" />
        <feComposite in="blot" in2="solid" operator="in" result="blotIn" />
        <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="21" result="n3" />
        <feColorMatrix in="n3" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.88  0.14 0 0 0 -0.06" result="lite" />
        <feComposite in="lite" in2="solid" operator="in" result="liteIn" />
        <feMerge>
          <feMergeNode in="wob" />
          <feMergeNode in="blotIn" />
          <feMergeNode in="liteIn" />
        </feMerge>
      </filter>
      <!-- for dark pieces, where any pale highlight turns to haze: a slight wobble and faint darkening only -->
      <filter id="soft-paint-dark" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="1" seed="4" result="n1" />
        <feDisplacementMap in="SourceGraphic" in2="n1" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="wob" />
        <feColorMatrix in="wob" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -11" result="solid" />
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="4" seed="11" result="n2" />
        <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0.02  0.12 0 0 0 -0.05" result="blot" />
        <feComposite in="blot" in2="solid" operator="in" result="blotIn" />
        <feMerge>
          <feMergeNode in="wob" />
          <feMergeNode in="blotIn" />
        </feMerge>
      </filter>
    </defs>
  </svg>
</template>

<style scoped>
.soft-paint {
  position: absolute;
}
</style>
