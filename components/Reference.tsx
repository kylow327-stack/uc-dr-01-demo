import { CONTROL_POINTS, FMEA_ROWS, GATES, HARD_RULES } from "@/lib/constants";
import { POLICY_ROWS } from "@/lib/policy/score";

export function Reference() {
  const fmea = [...FMEA_ROWS].sort((a, b) => b.rpn - a.rpn);

  return (
    <div className="mt-14 space-y-12">
      <section>
        <h2 className="font-display text-3xl uppercase">Hard rules</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {HARD_RULES.map((rule) => (
            <li key={rule} className="border-[1.5px] border-ink px-4 py-3 text-sm leading-relaxed">
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase">Policy table · CP-SCORE</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          This is the only tier assignment. The summarize node may draft wording. It cannot choose low, medium, or
          high. If any breaker is open, a POL-06 result stays low and the route becomes HITL.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Row</th>
                <th>When</th>
                <th>Tier</th>
                <th>Route</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {POLICY_ROWS.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.id}</td>
                  <td>{row.when}</td>
                  <td className="uppercase">{row.tier}</td>
                  <td className="uppercase">{row.route}</td>
                  <td className="font-mono text-xs">{row.control}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase">Control points</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Where</th>
                <th>Check</th>
                <th>Fail action</th>
              </tr>
            </thead>
            <tbody>
              {CONTROL_POINTS.map((control) => (
                <tr key={control.id}>
                  <td className="font-mono text-xs">{control.id}</td>
                  <td>{control.name}</td>
                  <td className="font-mono text-xs">{control.where}</td>
                  <td>{control.check}</td>
                  <td>{control.fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase">Failure modes</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Preliminary design scores, pending measurement of occurrence and detection. Illustrative, not measured
          production KPIs. RPN = S×O×D. As of 25 Oct 2026.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Failure mode</th>
                <th>S</th>
                <th>O</th>
                <th>D</th>
                <th>RPN</th>
                <th>Controls</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fmea.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.id}</td>
                  <td>{row.mode}</td>
                  <td>{row.s}</td>
                  <td>{row.o}</td>
                  <td>{row.d}</td>
                  <td>{row.rpn}</td>
                  <td className="font-mono text-xs">{row.controls}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase">Gates</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Status mirrored from the reference design as of 25 Oct 2026. This demo does not move a gate to signed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GATES.map((gate) => (
            <article key={gate.id} className="border-[1.5px] border-ink p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-navy">{gate.id}</p>
              <p className="mt-1 font-display text-2xl uppercase text-signal">{gate.status}</p>
              <p className="mt-2 text-sm leading-relaxed">{gate.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
