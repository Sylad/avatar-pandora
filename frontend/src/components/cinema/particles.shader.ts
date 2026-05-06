export const particlesVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDensity;
  // Mouse interaction : uMouse is the pointer in NDC (-1..1 on x and y),
  // uMouseStrength fades from 0..1 when the pointer enters/leaves the canvas.
  // The vertex shader pulls each particle toward the cursor with a
  // smoothstep falloff — close particles bend hard, far ones don't notice.
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  attribute float aSeed;
  varying float vSeed;
  varying float vDepth;
  varying float vMouseGlow;

  void main() {
    vSeed = aSeed;
    // Simple drift: vertical sway + slow horizontal sin
    vec3 p = position;
    p.y += sin(uTime * 0.15 + aSeed * 6.28) * 0.4;
    p.x += cos(uTime * 0.10 + aSeed * 9.42) * 0.3;

    // Project the un-attracted particle to NDC to measure mouse distance.
    vec4 mvPositionRaw = modelViewMatrix * vec4(p, 1.0);
    vec4 clipRaw = projectionMatrix * mvPositionRaw;
    vec2 ndc = clipRaw.xy / max(clipRaw.w, 0.0001);

    float dist = length(ndc - uMouse);
    // 0..1 attraction factor — full at 0, zero at 0.4 NDC away.
    float attract = smoothstep(0.4, 0.0, dist) * uMouseStrength;

    // Pull the particle toward the cursor in world XY. We scale by the
    // particle's depth so far ones drift visibly (otherwise the parallax
    // hides the effect).
    vec2 dir = (uMouse - ndc);
    float depthScale = 1.0 + max(-mvPositionRaw.z, 0.0) * 0.05;
    p.xy += dir * attract * 0.45 * depthScale;

    // Pass the attract factor to the fragment so it can intensify color
    // for particles caught in the cursor's bioluminescent halo.
    vMouseGlow = attract;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation by depth + density factor.
    // Clamp so particles too close to the camera don't blow up to fullscreen
    // (the additive blend then saturates and obscures all typography).
    // Caught particles also swell slightly (×1.0..1.4).
    gl_PointSize = clamp(
      uSize * uDensity * (300.0 / -mvPosition.z) * (1.0 + attract * 0.4),
      0.0,
      40.0
    );
  }
`;

export const particlesFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  varying float vDepth;
  varying float vMouseGlow;

  void main() {
    // Disc with soft edge
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, r);
    // Per-particle hue blend between A and B based on seed
    vec3 color = mix(uColorA, uColorB, vSeed);
    // Bioluminescent boost near the cursor — like Pandora's moss lighting
    // up under Jake's footsteps. Up to +120% color + +60% alpha at the
    // pointer's center, decaying smoothly outward via vMouseGlow.
    color *= 1.0 + vMouseGlow * 1.2;
    float glowAlpha = 1.0 + vMouseGlow * 0.6;
    // Soften far particles (depth fog)
    float fog = 1.0 - smoothstep(15.0, 35.0, vDepth);
    gl_FragColor = vec4(color, alpha * fog * 0.45 * glowAlpha);
  }
`;
