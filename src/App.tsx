import "./App.css";
import React, {
  useCallback,
  useState,
  createContext,
  useMemo,
  useContext,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { useThrottle } from "@react-hook/throttle";
import Color from "color";

function getDifferenceArray(
  c1: Color,
  c2: Color,
  type: ColorFunction = "hsl",
  distance: number = 1
) {
  let a1 = c1[type]().array();
  let a2 = c2[type]().array();
  return a2.map((b, i) => (b - a1[i]) / distance);
}

// #faec55, a color i enjoy
let indices = [0, 0.5, 1, 1.5, 2, 2.5];
let c500 = Color("#369145");
let c700 = Color("#24612e");

type ColorFunction =
  | "hsl"
  | "rgb"
  | "lab"
  | "lch"
  | "hwb"
  | "hsv"
  | "cmyk"
  | "xyz";

const shadeList = ["hsl", "rgb", "lab", "lch", "hwb", "hsv", "cmyk", "xyz"];

type TypeAllColors = {
  allColors: string[][];
  setAllColors: Dispatch<SetStateAction<string[][]>>;
  weights: number[];
  setWeights: Dispatch<SetStateAction<number[]>>;
};
const AllColors = createContext({} as TypeAllColors);
function Provider({ children }: { children: React.ReactNode }) {
  // Need to start with 8 for mixer
  const [allColors, setAllColors] = useState(Array(shadeList.length).fill([]));
  const [weights, setWeights] = useState(
    Array(allColors.length).fill(1 / allColors.length)
  );
  return (
    <AllColors.Provider
      value={{ allColors, setAllColors, weights, setWeights }}
    >
      {children}
    </AllColors.Provider>
  );
}

function ColorBar({
  type,
  scale,
  allColorIndex,
  colorIndex,
}: {
  type: ColorFunction;
  scale: number;
  allColorIndex: number;
  colorIndex: number;
}) {
  let [differenceArray] = useState(getDifferenceArray(c500, c700, type));
  let [baseArray] = useState(c500[type]().array());
  const { setAllColors } = useContext(AllColors);
  const color = useMemo(() => {
    let newArray = baseArray.map((n, i) => n + differenceArray[i] * scale);
    return Color[type](newArray).hex();
  }, [baseArray, type, differenceArray, scale]);
  useEffect(() => {
    setAllColors((c) => {
      c[allColorIndex] = c[allColorIndex] ? c[allColorIndex] : [];
      let arr = c[allColorIndex].slice(0);
      arr[colorIndex] = color;
      let newArr = c.slice(0);
      newArr[allColorIndex] = arr;
      return newArr;
    });
  }, [allColorIndex, color, colorIndex, setAllColors]);

  return <div className="color-bar" style={{ backgroundColor: color }} />;
}

function Shade({
  type,
  allColorIndex,
}: {
  type: ColorFunction;
  allColorIndex: number;
}) {
  const [bend, setBend] = useThrottle(1, 60);
  const handleBendChange = useCallback((e) => setBend(e.target.value), [
    setBend,
  ]);
  const fn = useCallback((n) => Math.pow(n, bend), [bend]);
  const reset = useCallback(() => {
    setBend(1);
  }, [setBend]);
  const multipliers = useMemo(() => {
    let list = indices.map((i) => fn(i));

    return list
      .slice(1)
      .reverse()
      .map((n) => -n)
      .concat(list)
      .slice(0, -1);
  }, [fn]);
  return (
    <div>
      <header className="shade-header">
        <h2>{type}</h2>
        <input
          type="range"
          min="0.025"
          max="2"
          step="0.025"
          value={bend}
          onChange={handleBendChange}
        />
        <button type="button" onClick={reset}>
          Reset
        </button>
      </header>
      <div className="bars">
        {multipliers.map((i, index) => (
          <ColorBar
            key={i}
            scale={i}
            type={type}
            allColorIndex={allColorIndex}
            colorIndex={index}
          />
        ))}
      </div>
    </div>
  );
}

function Aside() {
  const { allColors, weights, setWeights } = useContext(AllColors);
  const handleSetAll = useCallback(
    (index: number) => {
      setWeights((w) => w.map((value, i) => (i === index ? 1 : 0)));
    },
    [setWeights]
  );
  const handleUpdateValue = useCallback(
    (index, value) => {
      setWeights((currentValues) => {
        let newValues = currentValues.slice(0);
        newValues[index] = parseFloat(value);
        let total = newValues.reduce((a, v) => a + v, 0);
        while (Math.abs(total - 1) > 0.005) {
          if (total > 1) {
            // remove numbers with nothing
            let minAdjust = 1;
            let numbersToAdjust = currentValues.reduce<{ [k: string]: number }>(
              (a, v, i) => {
                if (i !== index && v > 0) {
                  a[i] = v;
                  // find the min of all other numbers
                  minAdjust = Math.min(minAdjust, v);
                }
                return a;
              },
              {}
            );
            let numbersToReduce = Object.keys(numbersToAdjust).length;
            let amountToReduce = (total - 1) / numbersToReduce;
            // find the amount to reduce of all other numbers
            amountToReduce = Math.min(amountToReduce, minAdjust);
            for (let key of Object.keys(numbersToAdjust)) {
              newValues[parseInt(key)] = parseFloat(
                (newValues[parseInt(key)] - amountToReduce).toFixed(3)
              );
            }
          } else if (total < 1) {
            // remove numbers set to 1
            let maxAdjust = 1;
            let numbersToAdjust = currentValues.reduce<{ [k: string]: number }>(
              (a, v, i) => {
                if (i !== index && v < 1) {
                  a[i] = v;
                  // find the min of all other numbers
                  maxAdjust = Math.min(maxAdjust, 1 - v);
                }
                return a;
              },
              {}
            );
            let numbersToIncrease = Object.keys(numbersToAdjust).length;
            let amountToIncrease = (1 - total) / numbersToIncrease;
            // find the amount to reduce of all other numbers
            amountToIncrease = Math.min(amountToIncrease, maxAdjust);
            for (let key of Object.keys(numbersToAdjust)) {
              newValues[parseInt(key)] = parseFloat(
                (newValues[parseInt(key)] + amountToIncrease).toFixed(3)
              );
            }
          }
          total = parseFloat(newValues.reduce((a, v) => a + v, 0).toFixed(3));
        }
        return newValues;
      });
    },
    [setWeights]
  );

  return (
    <aside>
      <h2>Mix</h2>
      <div className="color-list">
        {allColors.map((shades, index) => {
          if (shades.length > 9) {
            console.log(shades);
          }
          return (
            <div key={`color-${index}`} className="color-list-br">
              {shades.map((c, i) => (
                <div
                  key={`${c}-${i}`}
                  className="color-list-block"
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="range"
                className="color-mixer"
                value={weights[index]}
                min="0"
                max="1"
                step="0.0125"
                onChange={(e) => handleUpdateValue(index, e.target.value)}
              />
              <button onClick={() => handleSetAll(index)}>Full</button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Final() {
  const { allColors, weights } = useContext(AllColors);
  let finalWeights = weights.reduce<{ [k: number]: number }>(
    (acc, weight, index) => {
      if (weight !== 0) {
        acc[index] = weight;
      }
      return acc;
    },
    {}
  );
  let keys = Object.keys(finalWeights).map((k) => parseInt(k));
  let finalColors: string[] = allColors[keys[0]];
  // first weight, add subsequent weights
  let weightA = finalWeights[keys[0]];
  if (keys.length > 1) {
    for (let i = 1; i < keys.length; i++) {
      let weightB = finalWeights[keys[i]];
      let percentage = weightB / (weightA + weightB);
      finalColors = finalColors.map((currentColor, colorIndex) =>
        Color(currentColor)
          .mix(Color(allColors[keys[i]][colorIndex]), percentage)
          .hex()
      );
      weightA = weightA + weightB;
    }
  } else {
    finalColors = allColors[keys[0]];
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finalColors.join("\n"));
  }, [finalColors]);

  return (
    <div className="final-colors">
      {finalColors.map((c, i) => (
        <div
          key={`${c}-${i}`}
          style={{
            backgroundColor: c,
            color: Color(c).isDark() ? "white" : "black",
          }}
        >
          {c}
        </div>
      ))}
      <button onClick={handleCopy}>Copy To Clipboard</button>
    </div>
  );
}

function App() {
  return (
    <Provider>
      <div className="App">
        <div className="container">
          <div className="adjust">
            {shadeList.map((type, allColorIndex) => (
              <Shade
                key={type}
                type={type as ColorFunction}
                allColorIndex={allColorIndex}
              />
            ))}
          </div>
        </div>
        <Aside />
        <Final />
      </div>
    </Provider>
  );
}

export default App;
