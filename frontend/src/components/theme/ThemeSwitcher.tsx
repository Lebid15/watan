"use client";

import { useEffect, useState } from "react";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("system");

  // ✅ قراءة الثيم من localStorage عند أول تحميل
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("system");
    }
  }, []);

  // ✅ تغيير الثيم + حفظه في localStorage
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  // ✅ تطبيق الثيم فعليًا
  const applyTheme = (t: string) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else if (t === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      // system
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleThemeChange("light")}
        className={theme === "light" ? "font-bold" : ""}
      >
        Light
      </button>
      <button
        onClick={() => handleThemeChange("dark")}
        className={theme === "dark" ? "font-bold" : ""}
      >
        Dark
      </button>
      <button
        onClick={() => handleThemeChange("system")}
        className={theme === "system" ? "font-bold" : ""}
      >
        System
      </button>
    </div>
  );
}
