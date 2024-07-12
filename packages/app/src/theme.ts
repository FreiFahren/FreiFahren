import { extendTheme } from "native-base";

export const theme = extendTheme({
  colors: {
    bg2: "#131218",
    bg: "#1c1c1e",
    danger: "#EE4E4D",
    fg: "#8F91A2",
    success: "#C9F299",
    selected: "#22d6f2",
    lines: {
      U1: "#88ad58",
      U2: "#ca4c2b",
      U3: "#2f673f",
      U4: "#ecd94e",
      U5: "#785433",
      U6: "#886fa8",
      U7: "#459ad1",
      U8: "#2a4d83",
      U9: "#e48036",
      S1: "#cd71a1",
      S2: "#337639",
      S25: "#337639",
      S26: "#337639",
      S3: "#2b65a9",
      S41: "#a35d3c",
      S42: "#bf6a2b",
      S45: "#c79f5e",
      S46: "#c79f5e",
      S47: "#c79f5e",
      S5: "#dc7b2e",
      S7: "#7f6ea4",
      S75: "#7f6ea4",
      S8: "#76aa3a",
      S85: "#76aa3a",
      S9: "#8e2d45",
    },
  },
});

export type Theme = typeof theme;
