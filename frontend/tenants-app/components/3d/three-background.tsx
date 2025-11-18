'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    camera.position.z = 50;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xd4af37, 1, 100);
    pointLight1.position.set(25, 25, 25);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xcd7f32, 0.8, 100);
    pointLight2.position.set(-25, -25, 25);
    scene.add(pointLight2);

    // Geometries
    const geometries = [
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.SphereGeometry(2, 32, 32),
      new THREE.ConeGeometry(2, 4, 32),
      new THREE.TorusGeometry(2, 0.8, 16, 100),
      new THREE.OctahedronGeometry(2.5),
      new THREE.TetrahedronGeometry(2.5),
      new THREE.IcosahedronGeometry(2),
    ];

    // Materials for light theme (dark brown)
    const materialsLight = [
      new THREE.MeshPhongMaterial({
        color: 0x4a3728,
        shininess: 100,
        transparent: true,
        opacity: 0.95,
      }),
      new THREE.MeshPhongMaterial({
        color: 0x3d3329,
        shininess: 80,
        transparent: true,
        opacity: 0.9,
      }),
      new THREE.MeshPhongMaterial({
        color: 0x584b3a,
        shininess: 90,
        transparent: true,
        opacity: 0.95,
      }),
      new THREE.MeshPhongMaterial({
        color: 0x6f5f4b,
        shininess: 110,
        transparent: true,
        opacity: 0.85,
      }),
      new THREE.MeshPhongMaterial({
        color: 0x5c4a37,
        shininess: 70,
        transparent: true,
        opacity: 0.95,
      }),
    ];

    // Create floating shapes
    const shapes: THREE.Mesh[] = [];
    for (let i = 0; i < 50; i++) {
      const geometry =
        i < 30
          ? geometries[0]
          : geometries[Math.floor(Math.random() * geometries.length)];
      const material = materialsLight[
        Math.floor(Math.random() * materialsLight.length)
      ].clone();

      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = (Math.random() - 0.5) * 100;
      mesh.position.y = (Math.random() - 0.5) * 100;
      mesh.position.z = (Math.random() - 0.5) * 60;

      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;

      const scale = Math.random() * 0.8 + 0.4;
      mesh.scale.set(scale, scale, scale);

      (mesh as any).userData = {
        velocityX: (Math.random() - 0.5) * 0.02,
        velocityY: (Math.random() - 0.5) * 0.02,
        velocityZ: (Math.random() - 0.5) * 0.01,
        rotationSpeedX: (Math.random() - 0.5) * 0.02,
        rotationSpeedY: (Math.random() - 0.5) * 0.02,
        rotationSpeedZ: (Math.random() - 0.5) * 0.02,
      };

      shapes.push(mesh);
      scene.add(mesh);
    }

    // Particle System
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = (Math.random() - 0.5) * 150;
    }

    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x4a3728,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    document.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      shapes.forEach((shape, index) => {
        shape.rotation.x += shape.userData.rotationSpeedX;
        shape.rotation.y += shape.userData.rotationSpeedY;
        shape.rotation.z += shape.userData.rotationSpeedZ;

        shape.position.x += shape.userData.velocityX;
        shape.position.y += shape.userData.velocityY;
        shape.position.z += shape.userData.velocityZ;

        if (Math.abs(shape.position.x) > 50) shape.userData.velocityX *= -1;
        if (Math.abs(shape.position.y) > 50) shape.userData.velocityY *= -1;
        if (Math.abs(shape.position.z) > 30) shape.userData.velocityZ *= -1;

        const pulse = Math.sin(Date.now() * 0.001 + index) * 0.1 + 1;
        shape.scale.set(
          (shape.scale.x * pulse) / (pulse - 0.1 + 1),
          (shape.scale.y * pulse) / (pulse - 0.1 + 1),
          (shape.scale.z * pulse) / (pulse - 0.1 + 1)
        );
      });

      particles.rotation.y += 0.0005;
      particles.rotation.x += 0.0003;

      camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 5 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none"
    />
  );
}
