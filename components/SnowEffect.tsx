import React, { useEffect, useRef } from 'react';

const SnowEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    // Konfiguration
    const flakeCount = 100; // Anzahl der Flocken (nicht zu viele für Performance/Dezenz)
    const flakes: { x: number; y: number; r: number; d: number; a: number; speed: number }[] = [];

    // Initialisierung der Flocken
    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 2 + 0.5, // Radius: Klein und fein (0.5px bis 2.5px)
        d: Math.random() * flakeCount, // Dichte-Faktor für Bewegung
        a: Math.random(), // Winkel für Schwingung
        speed: Math.random() * 0.5 + 0.2 // Fallgeschwindigkeit (langsam)
      });
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; // Weiß mit leichter Transparenz
      ctx.beginPath();

      for (let i = 0; i < flakeCount; i++) {
        const f = flakes[i];
        
        // Zeichne Flocke
        ctx.moveTo(f.x, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);

        // Update Position
        f.y += f.speed; // Fallen
        f.x += Math.sin(f.a) * 0.3; // Leichtes seitliches Wehen (Wind)
        f.a += 0.02; // Schwingung erhöhen

        // Reset wenn unten angekommen
        if (f.y > height) {
          flakes[i] = { 
            x: Math.random() * width, 
            y: -10, // Startet wieder oben knapp außerhalb
            r: f.r, 
            d: f.d, 
            a: f.a, 
            speed: f.speed 
          };
        }
        
        // Wrap around wenn seitlich rausgeweht
        if (f.x > width + 5) flakes[i].x = -5;
        if (f.x < -5) flakes[i].x = width + 5;
      }

      ctx.fill();
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Resize Handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-[5]"
      style={{ opacity: 0.7 }} // Gesamteffekt leicht dimmen
    />
  );
};

export default SnowEffect;