import { createSignal, onCleanup, createState, SetStateFunction, State, For } from "solid-js";
import "../src/main.scss";
import { render } from "solid-js/dom";

function range<T>(start: number, end: number, action: (i: number) => T) {
  return Array.from(Array(Math.abs(end - start)), (_, i) => action(start + i));
}

function useTick(delay: number) {
  const [getCount, setCount] = createSignal(0);
  const handle = setInterval(() => setCount(getCount() + 1), delay);
  onCleanup(() => clearInterval(handle));
  return getCount;
}

type Setter<T> = (i: number, j: number, value: T) => void;
let [maxElement, setMaxElement] = createSignal(0);

const zeros = (dimension: number) => range(0, dimension, () => range(0, dimension, () => 0));

function use2DArray(input: number[][]): [State<number[][]>, Setter<number>] {
  const [data, setData] = createState(input);
  const set = (i: number, j: number, value: number) => {
    if (value > maxElement()) {
      setMaxElement(value);
    }
    setData(i, j, () => value);
  };
  return [data, set];
}

// As it turns out this does exactly what is promised.
// Setting the data updates the DOM element that is now subscribed
// to that data. This looks extensively like react, but it isn't,
// and it saves re-rendering, and that makes me love it dearly.
//
// It seems one of the failure cases is that it cannot detect a certain side
// effect is not an infinite loop (you cannot update a signal while in a get()
// on a different signal), but this is okay, that seems horrendous anyway.
// You'd want to do that only if you were tracking gets, which is kind of like
// tracking reads to a variable, and these shouldn't be performance intensive...
const ElementGrid = ({ dimension }: { dimension: number }) => {
  const [data, setData] = use2DArray(zeros(dimension));

  // Randomly fill a box of squares on a keypress according to # size.
  // Question: How do we clean this up if the component unmounts?
  // I guess unmounting is the wrong abstraction here. The code runs once.
  // The listener is there to stay unless something else removes it.
  // So let's see a scenario where we have e.g. a collapsible element in Solid:
  //
  // <Collapse open={true}  /> renders the grid & adds the handler
  // <Collapse open={false} /> shouldn't render the grid, and the handler
  // should also go away, we don't want to be swallowing these and doing god
  // knows what.
  const addSquare = (e: KeyboardEvent) => {
    if (e.keyCode >= 48 && e.keyCode <= 57) {
      const size = e.keyCode - 48;
      const startX = Math.floor(Math.random() * (dimension + 0.999 - size));
      const startY = Math.floor(Math.random() * (dimension + 0.999 - size));
      for (let i = startY; i < startY + size; i++) {
        for (let j = startX; j < startX + size; j++) {
          setData(i, j, data[i][j] + 1);
        }
      }
    }
  };

  const d = dimension - 1;
  return () => {
    // console.log("adding");
    document.body.addEventListener("keydown", addSquare);
    onCleanup(() => {
      // console.log("removing");
      document.body.removeEventListener("keydown", addSquare);
    });
    return (
      <>
        <div class="container">
          {range(0, dimension, (i) => (
            <div class="row">
              {range(0, dimension, (j) => {
                const value = () => data[i][j];
                const color = () => (maxElement() === 0 ? 0 : value() / maxElement());
                const textColor = () => (color() > 0.4 ? "#ddd" : "#222");
                return (
                  <div
                    class="cell"
                    style={{
                      color: textColor(),
                      "background-color": `rgba(0,0,0,${color()})`,
                    }}
                    // Update the opposite (mirror-axis) square.
                    onClick={(e) => {
                      console.log("subclick");
                      setData(j, i, data[i][j] + 1);
                      setData(d - j, d - i, data[i][j] + 1);
                      e.preventDefault();
                      e.stopPropagation();
                    }}>
                    <span>{value()}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </>
    );
  };
};

type CollapseProps = {
  open: boolean;
  children: JSX.Element;
};

const Collapse = ({ open, children }: CollapseProps) => {
  const [isOpen, setIsOpen] = createSignal(open);

  const Frame = ({ children }: { children: JSX.Element }) => (
    <div
      className="collapse"
      onClick={() => {
        setIsOpen(!isOpen());
        // console.log(isOpen());
      }}>
      {children}
    </div>
  );

  // Key point: this needs to be a function, so that the signal can compute,
  // because if it is not, it cannot be re-evaluated.
  const result = () => (
    <Frame>
      <span style={{ display: "block", margin: "20px", "z-index": 2 }}>Click to {isOpen() ? "Close" : "Open"}</span>
      <div
        className={"expand"}
        style={{
          "max-height": isOpen() ? "570px" : "0px",
          opacity: isOpen() ? 1 : 0,
        }}>
        {children}
      </div>
    </Frame>
  );

  return result;
};

const VirtualList = () => {
  let rows = 100;
  let [display, setDisplay] = createSignal(0);

  return (
    <div className="list-container" style={{ "max-height": "501px", width: "514px" }}>
      <div>
        {range(0, 10, (i) => (
          <div style={{ height: "49px" }} className="grid-row">
            {range(0, 10, (j) => (
              <span>{`${display() + i}.${j}`}</span>
            ))}
          </div>
        ))}
      </div>
      <div
        className="fake-scroll"
        onClick={(e) => console.log(e.clientX, e.clientY)}
        onScroll={(e) => {
          console.log(e.target.scrollTop);
          setDisplay(Math.round(e.target.scrollTop / 50));
        }}>
        <div style={{ width: "1px", height: "5000px" }}></div>
      </div>
    </div>
  );
};

const app = () => <VirtualList />;

let element = document.getElementById("main");
if (element) {
  render(app, element);
} else {
  console.log("main div not found.");
}

// TODOS:
// Make the collapse, described above
// Make a virtualized list, to see how it might work.
// I don't think that works very well. But we should try it regardless.
