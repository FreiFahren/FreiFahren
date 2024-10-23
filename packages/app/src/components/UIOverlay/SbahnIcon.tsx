import { Circle, Path, Svg, SvgProps } from "react-native-svg";

export const SbahnIcon = (props: SvgProps) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    style={{
      enableBackground: "new 0 0 100 100",
    }}
    viewBox="0 0 100 100"
    width={40}
    height={40}
    {...props}
  >
    <Circle
      cx={50}
      cy={50}
      r={49}
      style={{
        fill: "#439844",
      }}
    />
    <Path
      d="M37.049 29.354c0-4.01 3.682-7.445 10.116-7.445 11.356 0 21.046 6.103 27.474 13.046V22.831c-7.424-5.767-16.79-9.187-27.233-9.187-12.523 0-26.476 7.688-26.476 21.976 0 27.253 41.348 17.465 41.348 33.269 0 4.175-5.511 8.112-12.361 8.112-11.202 0-22.302-6.775-28.405-15.548v14.534c6.435 5.764 18.213 10.366 28.405 10.366 18.294 0 29.153-13.035 29.153-24.231 0-27.75-42.021-15.883-42.021-32.768z"
      style={{
        fill: "#fff",
      }}
    />
  </Svg>
);
