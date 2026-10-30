import { ROLES, SHARED_ACCESS } from "../auth.jsx";

/** The role difference in one place: both roles read the same evidence, only an
 *  investigator can run the two actions that write to the chain of custody. */
export default function RoleTable() {
  return (
    <div className="roles">
      <div className="role-shared">
        <div className="role-shared-head">Both roles see everything</div>
        <ul>
          {SHARED_ACCESS.map((line) => (
            <li key={line}><span className="auth-tick" aria-hidden="true">✓</span>{line}</li>
          ))}
        </ul>
      </div>

      <div className="role-split">
        {Object.entries(ROLES).map(([key, r]) => (
          <div className={`role-card role-${key}`} key={key}>
            <div className="role-head">
              <span className="badge outline">{r.label}</span>
            </div>
            <p className="muted-text small" style={{ margin: "9px 0 10px" }}>{r.blurb}</p>
            {r.extra.length ? (
              <ul className="role-list">
                {r.extra.map((line) => (
                  <li key={line}><span className="role-plus" aria-hidden="true">+</span>{line}</li>
                ))}
              </ul>
            ) : (
              <ul className="role-list">
                <li className="muted-text">
                  <span className="role-minus" aria-hidden="true">–</span>
                  No write actions: Re-verify and PDF export are hidden
                </li>
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="muted-text small" style={{ margin: "12px 0 0" }}>
        The line is deliberate: re-verifying appends an <code>analyzed</code> entry and exporting a report
        appends a <code>report_exported</code> entry, so both change the evidence record. Reading never does.
      </p>
    </div>
  );
}
