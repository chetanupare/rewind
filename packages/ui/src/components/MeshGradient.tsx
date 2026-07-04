import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  varying vec2 vUv;

  vec3 palette(float t) {
    return mix(
      mix(uColor1, uColor2, t),
      mix(uColor3, uColor4, t),
      t * t
    );
  }

  void main() {
    vec2 uv = vUv;
    
    float t1 = sin(uv.x * 2.0 + uTime * 0.3) * 0.5 + 0.5;
    float t2 = cos(uv.y * 3.0 - uTime * 0.2) * 0.5 + 0.5;
    float t3 = sin((uv.x + uv.y) * 1.5 + uTime * 0.4) * 0.5 + 0.5;
    
    float t = (t1 + t2 + t3) / 3.0;
    
    vec3 color = palette(t);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function GradientPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#5B2EFF') },
      uColor2: { value: new THREE.Color('#8A3FFC') },
      uColor3: { value: new THREE.Color('#FF4D9D') },
      uColor4: { value: new THREE.Color('#5B2EFF') },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh>
      <planeGeometry args={[6, 6, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function MeshGradient({ className = '' }: { className?: string }) {
  return (
    <div className={`mesh-gradient ${className}`} style={{ position: 'relative', overflow: 'hidden' }}>
      <Canvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        camera={{ position: [0, 0, 2], fov: 45 }}
      >
        <GradientPlane />
      </Canvas>
    </div>
  );
}

export default MeshGradient;
