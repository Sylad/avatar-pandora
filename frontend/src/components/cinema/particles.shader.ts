export const particlesVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDensity;
  attribute float aSeed;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vSeed = aSeed;
    // Simple drift: vertical sway + slow horizontal sin
    vec3 p = position;
    p.y += sin(uTime * 0.15 + aSeed * 6.28) * 0.4;
    p.x += cos(uTime * 0.10 + aSeed * 9.42) * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation by depth + density factor.
    // Clamp so particles too close to the camera don't blow up to fullscreen
    // (the additive blend then saturates and obscures all typography).
    gl_PointSize = clamp(uSize * uDensity * (300.0 / -mvPosition.z), 0.0, 40.0);
  }
`;

export const particlesFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // Disc with soft edge
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, r);
    // Per-particle hue blend between A and B based on seed
    vec3 color = mix(uColorA, uColorB, vSeed);
    // Soften far particles (depth fog)
    float fog = 1.0 - smoothstep(15.0, 35.0, vDepth);
    gl_FragColor = vec4(color, alpha * fog * 0.45);
  }
`;
