import { Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { T } from "../tokens";

/** Map game hour to a period emoji + label */
function timePeriod(h: number): { icon: string; label: string } {
  if (h < 5 || h > 20)  return { icon: "🌙", label: "Night" };
  if (h >= 5 && h < 8)  return { icon: "🌅", label: "Dawn" };
  if (h >= 8 && h < 12)  return { icon: "☀️", label: "Morning" };
  if (h >= 12 && h < 14) return { icon: "☀️", label: "Midday" };
  if (h >= 14 && h < 17) return { icon: "🌤️", label: "Afternoon" };
  return { icon: "🌇", label: "Dusk" };
}

const WEATHER_DISPLAY: Record<string, { icon: string; label: string }> = {
  clear:     { icon: "✨", label: "Clear" },
  rain:      { icon: "🌧️", label: "Rain" },
  snow:      { icon: "❄️", label: "Snow" },
  fog:       { icon: "🌫️", label: "Fog" },
  sandstorm: { icon: "🌪️", label: "Sandstorm" },
  storm:     { icon: "⛈️", label: "Storm" },
};

export function WorldStatus() {
  const [data, setData] = useState<{ timeOfDay: number; weather: string }>({
    timeOfDay: 12,
    weather: "clear",
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setData(detail);
    };
    window.addEventListener("abraxas-world-update", handler);
    return () => window.removeEventListener("abraxas-world-update", handler);
  }, []);

  const time = timePeriod(data.timeOfDay);
  const weather = WEATHER_DISPLAY[data.weather] ?? WEATHER_DISPLAY.clear;
  const gameHour = Math.floor(data.timeOfDay);
  const gameMin = Math.floor((data.timeOfDay % 1) * 60);
  const clockStr = `${String(gameHour).padStart(2, "0")}:${String(gameMin).padStart(2, "0")}`;

  return (
    <Flex
      justify="center"
      align="center"
      gap="3"
      py="1"
      px="3"
    >
      <Flex align="center" gap="1">
        <Text fontSize="11px" lineHeight="1">{time.icon}</Text>
        <Text textStyle={T.codeText} color={T.goldDark} fontSize="10px">{clockStr}</Text>
      </Flex>
      <Text color={T.border} fontSize="8px" lineHeight="1">•</Text>
      <Flex align="center" gap="1">
        <Text fontSize="11px" lineHeight="1">{weather.icon}</Text>
        <Text textStyle={T.codeText} color={T.goldDark} fontSize="10px">{weather.label}</Text>
      </Flex>
    </Flex>
  );
}
