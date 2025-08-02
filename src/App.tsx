import arkFidLogo from "./assets/arkfid--color.svg";
import "./App.css";

function App() {
  return (
    <>
      <div>
        <div style={{ marginRight: "auto", marginLeft: "auto", width: 100, marginBottom: 100, marginTop: 100 }}>
          <img src={arkFidLogo} width={100} />
        </div>
        <b>We'll Be Back Soon!</b>
        <p>
          Regrettably, this website is temporarily unavailable as we perform
          necessary maintenance.
        </p>
      </div>
    </>
  );
}

export default App;
