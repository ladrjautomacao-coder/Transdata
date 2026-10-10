import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2 } from "lucide-react";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import logoTransdata from "@/assets/logo-transdata.png";

const LETTERS_TRANS = "TRANS".split("");
const LETTERS_MOBILE = "DATA".split("");

function MiniRobot({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.svg
      width="60"
      height="70"
      viewBox="0 0 60 70"
      className="absolute bottom-0 z-20"
      initial={{ x: -80, opacity: 0 }}
      animate={{
        x: [-80, 0, 0, 60],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 2.5,
        times: [0, 0.3, 0.8, 1],
        ease: "easeInOut",
      }}
      onAnimationComplete={onComplete}
    >
      {/* Body */}
      <motion.rect
        x="15" y="25" width="30" height="30" rx="4"
        fill="hsl(220 15% 30%)"
        stroke="hsl(28 90% 52%)"
        strokeWidth="1.5"
      />
      {/* Head */}
      <motion.rect
        x="18" y="10" width="24" height="18" rx="3"
        fill="hsl(220 15% 25%)"
        stroke="hsl(28 90% 52%)"
        strokeWidth="1.5"
      />
      {/* Eyes */}
      <motion.circle cx="25" cy="19" r="3" fill="hsl(28 90% 52%)"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <motion.circle cx="35" cy="19" r="3" fill="hsl(28 90% 52%)"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0.1 }}
      />
      {/* Antenna */}
      <motion.line x1="30" y1="10" x2="30" y2="2" stroke="hsl(28 90% 52%)" strokeWidth="1.5" />
      <motion.circle cx="30" cy="2" r="2.5" fill="hsl(28 90% 52%)"
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      {/* Left arm lifting */}
      <motion.line
        x1="15" y1="35" x2="5" y2="45"
        stroke="hsl(28 90% 52%)" strokeWidth="2" strokeLinecap="round"
        animate={{ x2: [5, 2, 5], y2: [45, 15, 15] }}
        transition={{ duration: 1.5, times: [0, 0.5, 1] }}
      />
      {/* Right arm lifting */}
      <motion.line
        x1="45" y1="35" x2="55" y2="45"
        stroke="hsl(28 90% 52%)" strokeWidth="2" strokeLinecap="round"
        animate={{ x2: [55, 58, 55], y2: [45, 15, 15] }}
        transition={{ duration: 1.5, times: [0, 0.5, 1] }}
      />
      {/* Legs */}
      <rect x="20" y="55" width="6" height="10" rx="2" fill="hsl(220 15% 30%)" />
      <rect x="34" y="55" width="6" height="10" rx="2" fill="hsl(220 15% 30%)" />
      {/* Treads */}
      <motion.rect x="18" y="63" width="10" height="4" rx="2" fill="hsl(220 15% 20%)" />
      <motion.rect x="32" y="63" width="10" height="4" rx="2" fill="hsl(220 15% 20%)" />
    </motion.svg>
  );
}

export default function LogoAnimation() {
  const branding = useTenantBranding();
  // A animação de letras "TRANS"/"DATA" é um trocadilho específico da
  // Transdata — não generaliza pro nome de outro cliente, então só toca
  // pra esse tenant; os demais vão direto pro logo/nome final.
  const isTransdata = branding.slug === "transdata";
  const [phase, setPhase] = useState<"fallen" | "lifting" | "glow" | "done">(isTransdata ? "fallen" : "done");

  useEffect(() => {
    if (!isTransdata) return;
    const timer = window.setTimeout(() => setPhase("done"), 5500);
    return () => window.clearTimeout(timer);
  }, [isTransdata]);

  const startLift = () => {
    setTimeout(() => setPhase("lifting"), 600);
  };

  const letterStyle = "font-['Rajdhani',sans-serif] font-bold text-4xl tracking-wider";

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ perspective: "800px" }}>
      {/* Glow background */}
      <AnimatePresence>
        {(phase === "glow" || phase === "done") && (
          <motion.div
            className="absolute inset-0 -m-8 rounded-2xl z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0.4, 0.6],
              scale: [0.95, 1.05, 1],
            }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              background: "radial-gradient(circle, hsl(28 90% 52% / 0.25) 0%, transparent 70%)",
              boxShadow: "0 0 60px hsl(28 90% 52% / 0.3), 0 0 120px hsl(28 90% 52% / 0.15)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Animated letters or real logo */}
      <AnimatePresence mode="wait">
        {phase !== "done" ? (
          <motion.div
            key="letters"
            className="relative z-10 flex flex-col items-center"
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            {/* TRANS row */}
            <div className="flex">
              {LETTERS_TRANS.map((letter, i) => (
                <motion.span
                  key={`t-${i}`}
                  className={`${letterStyle} text-primary-foreground`}
                  style={{ transformOrigin: "bottom center", display: "inline-block" }}
                  initial={{ rotateX: 80, opacity: 0.3, y: 10 }}
                  animate={
                    phase === "fallen"
                      ? { rotateX: 80, opacity: 0.3, y: 10 }
                      : { rotateX: 0, opacity: 1, y: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 12,
                    delay: phase === "lifting" ? i * 0.08 : 0,
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
            {/* MOBILE row */}
            <div className="flex -mt-2">
              {LETTERS_MOBILE.map((letter, i) => (
                <motion.span
                  key={`m-${i}`}
                  className={`${letterStyle} text-primary`}
                  style={{ transformOrigin: "bottom center", display: "inline-block" }}
                  initial={{ rotateX: 80, opacity: 0.3, y: 10 }}
                  animate={
                    phase === "fallen"
                      ? { rotateX: 80, opacity: 0.3, y: 10 }
                      : { rotateX: 0, opacity: 1, y: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 12,
                    delay: phase === "lifting" ? (LETTERS_TRANS.length + i) * 0.08 : 0,
                  }}
                  onAnimationComplete={() => {
                    if (phase === "lifting" && i === LETTERS_MOBILE.length - 1) {
                      setPhase("glow");
                      setTimeout(() => setPhase("done"), 1800);
                    }
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            {/* Robot */}
            {phase === "fallen" && (
              <div className="relative w-full flex justify-center mt-2">
                <MiniRobot onComplete={startLift} />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="logo"
            className="z-10 relative flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            {branding.logoUrl ? (
              <img src={isTransdata ? logoTransdata : branding.logoUrl} alt={branding.portalName} className={isTransdata ? "h-32 rounded-xl" : "h-32 w-32 rounded-full object-cover"} />
            ) : (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-foreground/10 text-primary-foreground">
                  <Building2 className="h-12 w-12" />
                </div>
                <span className="text-2xl font-bold text-primary-foreground">{branding.portalName}</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsing glow ring after done */}
      {phase === "done" && (
        <motion.div
          className="absolute inset-0 -m-6 rounded-2xl z-0 pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 20px hsl(28 90% 52% / 0.15)",
              "0 0 40px hsl(28 90% 52% / 0.3)",
              "0 0 20px hsl(28 90% 52% / 0.15)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
