"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "./ui/button";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificar se já existe consentimento salvo
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Pequeno delay para a animação de entrada ficar mais natural
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-none"
        >
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <div className="bg-[#0f1219]/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row items-center p-6 gap-6 relative">
              
              <button 
                onClick={handleDecline}
                className="absolute top-4 right-4 text-slate-400 hover:text-white sm:hidden"
              >
                <X size={20} />
              </button>

              <div className="flex-shrink-0 bg-primary/10 p-3 rounded-full hidden sm:block">
                <Cookie className="w-8 h-8 text-primary" />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-white font-bold text-lg mb-1 flex items-center justify-center sm:justify-start gap-2">
                  <Cookie className="w-5 h-5 text-primary sm:hidden" />
                  Nós valorizamos sua privacidade
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência de navegação, 
                  analisar o tráfego do site e personalizar conteúdo conforme a LGPD. 
                  Ao continuar navegando, você concorda com estas condições.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <Button 
                  onClick={handleDecline} 
                  variant="outline" 
                  className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Recusar
                </Button>
                <Button 
                  onClick={handleAccept} 
                  className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-primary-foreground font-bold"
                >
                  Aceitar Cookies
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
