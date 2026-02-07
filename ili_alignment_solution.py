"""
ILI Data Alignment + Anomaly Matching (Hackathon-ready baseline solution)

Inputs:
  - ILIDataV2.xlsx with sheets: 2007, 2015, 2022

Outputs:
  - ILI_aligned_output.xlsx:
      * <YEAR>_aligned: original rows + computed station_base_ft (aligned station)
      * anomalies_<YEAR>: filtered anomaly rows with aligned station
      * matches_2015_2022: matched anomalies between 2015 and 2022
      * matches_2007_2015: matched anomalies between 2007 and 2015

Core idea:
  1) Use a chosen baseline run (default: 2015) to define a common coordinate system (station_base_ft).
  2) For runs with reliable Joint Number + Distance-to-upstream-weld:
       station_base_ft = baseline_joint_start + (dus / joint_len) * baseline_joint_len
     This removes odometer drift because we reference the weld-defined joint coordinate.
  3) For runs where joint numbering doesn't fully match baseline (e.g., early 2007 segments),
     fall back to using Girth Weld sequences to build a piecewise-linear mapping from that run's
     reported distance -> baseline station.
  4) Match anomalies across runs using a proximity window + simple similarity cost.

This is a pragmatic MVP: accurate enough for demos and easy to explain/extend.
"""

from __future__ import annotations
import os
import numpy as np
import pandas as pd

INPUT_XLSX = "ILIDataV2.xlsx"
OUTPUT_XLSX = "ILI_aligned_output.xlsx"

BASELINE_YEAR = "2015"  # common coordinate system is built from this run

# Matching tolerance (ft) for anomaly station proximity
MATCH_DIST_TOL_FT = 5.0


SCHEMA = {
    "2007": {
        "joint": "J. no.",
        "joint_len": "J. len [ft]",
        "dus": "to u/s w. [ft]",
        "raw_dist": "log dist. [ft]",
        "event": "event",
        "depth": "depth [%]",
        "length": "length [in]",
        "width": "width [in]",
        "clock": "o'clock",
    },
    "2015": {
        "joint": "J. no.",
        "joint_len": "J. len [ft]",
        "dus": "to u/s w. [ft]",
        "raw_dist": "Log Dist. [ft]",
        "event": "Event Description",
        "depth": "Depth [%]",
        "length": "Length [in]",
        "width": "Width [in]",
        "clock": "O'clock",
    },
    "2022": {
        "joint": "Joint Number",
        "joint_len": "Joint Length [ft]",
        "dus": "Distance to U/S GW \n[ft]",
        "raw_dist": "ILI Wheel Count \n[ft.]",
        "event": "Event Description",
        "depth": "Metal Loss Depth \n[%]",
        "length": "Length [in]",
        "width": "Width [in]",
        "clock": "O'clock\n[hh:mm]",
    },
}


def standardize(df: pd.DataFrame, year: str) -> pd.DataFrame:
    sch = SCHEMA[year]
    rename = {
        sch["joint"]: "joint",
        sch["joint_len"]: "joint_len_ft",
        sch["dus"]: "dus_ft",
        sch["raw_dist"]: "raw_dist_ft",
        sch["event"]: "event",
        sch["depth"]: "depth_pct",
        sch["length"]: "length_in",
        sch["width"]: "width_in",
        sch["clock"]: "clock",
    }
    d = df.rename(columns=rename).copy()

    # numeric conversion
    for col in ["joint", "joint_len_ft", "dus_ft", "raw_dist_ft", "depth_pct", "length_in", "width_in"]:
        if col in d.columns:
            d[col] = pd.to_numeric(d[col], errors="coerce")

    d["event"] = d["event"].astype(str).str.strip()
    d["event_norm"] = d["event"].str.lower().str.replace(r"\s+", " ", regex=True)
    return d


def build_baseline_joint_table(base: pd.DataFrame) -> pd.DataFrame:
    """
    Build baseline joint length and start-station table from the baseline run.
    """
    joint_len = (
        base.groupby("joint", dropna=True)["joint_len_ft"]
        .apply(lambda s: s.dropna().iloc[0] if s.dropna().size else np.nan)
        .dropna()
        .sort_index()
    )
    joint_start = joint_len.cumsum().shift(fill_value=0)
    return pd.DataFrame(
        {
            "joint": joint_len.index.values,
            "joint_len_base_ft": joint_len.values,
            "joint_start_base_ft": joint_start.values,
        }
    )


def align_by_joint(d: pd.DataFrame, joint_df: pd.DataFrame) -> pd.DataFrame:
    """
    Primary alignment: use joint number and distance-to-upstream-weld (dus_ft).
    """
    dd = d.merge(joint_df, on="joint", how="left")
    # If joint_len_ft is missing (often true on anomaly rows), use baseline joint length for normalization
    denom = dd["joint_len_ft"].where(dd["joint_len_ft"].notna(), dd["joint_len_base_ft"])
    dd["p_in_joint"] = dd["dus_ft"] / denom
    dd.loc[dd["p_in_joint"].notna(), "p_in_joint"] = dd.loc[dd["p_in_joint"].notna(), "p_in_joint"].clip(-0.5, 1.5)
    dd["station_base_ft"] = dd["joint_start_base_ft"] + dd["p_in_joint"] * dd["joint_len_base_ft"]
    return dd


def align_2007_by_weld_sequence(d2007: pd.DataFrame, base2015: pd.DataFrame, joint_df: pd.DataFrame) -> pd.DataFrame:
    """
    Fallback alignment for 2007:
    Create a piecewise-linear mapping from 2007 raw distance -> baseline station
    using the sequence of Girth Weld events.
    """
    w2007 = (
        d2007[d2007["event_norm"].str.contains("girth weld", na=False) & d2007["raw_dist_ft"].notna()]
        .sort_values("raw_dist_ft")
    )

    wbase = base2015.merge(joint_df, on="joint", how="left")
    wbase = wbase[
        wbase["event_norm"].str.contains("girthweld", na=False) & wbase["raw_dist_ft"].notna()
    ].sort_values("raw_dist_ft")

    n = min(len(w2007), len(wbase))
    x = w2007["raw_dist_ft"].values[:n]
    y = wbase["joint_start_base_ft"].values[:n]

    # map all raw distances to baseline station
    station = np.interp(d2007["raw_dist_ft"].values, x, y, left=np.nan, right=np.nan)
    out = d2007.copy()
    out["station_base_ft"] = station
    return out


def is_anomaly_event(evnorm: str) -> bool:
    """
    Define what we treat as an anomaly for matching.
    """
    if not isinstance(evnorm, str):
        return False
    ev = evnorm
    return (
        ("metal loss" in ev)
        or ("cluster" in ev)
        or ("dent" in ev)
        or ("manufacturing anomaly" in ev)
        or ("seam weld" in ev)
    ) and ("girth" not in ev)


def extract_anomalies(d: pd.DataFrame, year: str) -> pd.DataFrame:
    a = d[d["event_norm"].apply(is_anomaly_event) & d["station_base_ft"].notna()].copy()
    a["year"] = int(year)
    keep = [
        "year",
        "station_base_ft",
        "joint",
        "p_in_joint",
        "event",
        "event_norm",
        "depth_pct",
        "length_in",
        "width_in",
        "clock",
    ]
    for c in keep:
        if c not in a.columns:
            a[c] = np.nan
    return a[keep]


def match_runs(a_base: pd.DataFrame, a_new: pd.DataFrame, dist_tol_ft: float) -> pd.DataFrame:
    """
    Greedy + mutual-nearest matching.
    Cost combines station proximity and some geometry.
    """
    b = a_base.sort_values("station_base_ft").reset_index(drop=True)
    n = a_new.sort_values("station_base_ft").reset_index(drop=True)

    b_pos = b["station_base_ft"].values
    matches = []

    for i, row in n.iterrows():
        s = float(row["station_base_ft"])
        lo = np.searchsorted(b_pos, s - dist_tol_ft, side="left")
        hi = np.searchsorted(b_pos, s + dist_tol_ft, side="right")
        if lo == hi:
            continue

        cand = b.iloc[lo:hi].copy()

        dist = np.abs(cand["station_base_ft"].values - s) / dist_tol_ft

        def z(v):
            return 0.0 if pd.isna(v) else float(v)

        depth = np.abs(cand["depth_pct"].fillna(0).values - z(row["depth_pct"])) / 50.0
        length = np.abs(cand["length_in"].fillna(0).values - z(row["length_in"])) / 50.0
        width = np.abs(cand["width_in"].fillna(0).values - z(row["width_in"])) / 50.0

        cost = dist + 0.5 * depth + 0.25 * length + 0.25 * width
        j = int(np.argmin(cost))

        best = cand.iloc[j]
        matches.append((i, best.name, float(cost[j]), float(best["station_base_ft"] - s)))

    if not matches:
        return pd.DataFrame(columns=["new_idx", "base_idx", "cost", "delta_station_ft"])

    m = pd.DataFrame(matches, columns=["new_idx", "base_idx", "cost", "delta_station_ft"])
    m = m.sort_values("cost")
    m = m.drop_duplicates("new_idx", keep="first")
    m = m.drop_duplicates("base_idx", keep="first")
    return m


def main() -> None:
    if not os.path.exists(INPUT_XLSX):
        raise FileNotFoundError(f"Cannot find {INPUT_XLSX} in the working directory.")

    years = ["2007", "2015", "2022"]
    raw = {y: pd.read_excel(INPUT_XLSX, sheet_name=y) for y in years}
    std = {y: standardize(raw[y], y) for y in years}

    base = std[BASELINE_YEAR]
    joint_df = build_baseline_joint_table(base)

    # Align 2015 + 2022 by joint coordinates
    aligned = {
        "2015": align_by_joint(std["2015"], joint_df),
        "2022": align_by_joint(std["2022"], joint_df),
    }

    # Align 2007 by weld-sequence mapping into baseline stations
    aligned["2007"] = align_2007_by_weld_sequence(std["2007"], std["2015"], joint_df)

    # Extract anomalies
    a2007 = extract_anomalies(aligned["2007"], "2007")
    a2015 = extract_anomalies(aligned["2015"], "2015")
    a2022 = extract_anomalies(aligned["2022"], "2022")

    # Match anomalies
    m15_22 = match_runs(a2015, a2022, dist_tol_ft=MATCH_DIST_TOL_FT)
    m07_15 = match_runs(a2007, a2015, dist_tol_ft=MATCH_DIST_TOL_FT)

    # Build match tables (join matched rows side-by-side)
    b15 = a2015.reset_index(drop=True)
    n22 = a2022.reset_index(drop=True)
    match_15_22 = pd.concat(
        [
            m15_22,
            n22.loc[m15_22["new_idx"]].reset_index(drop=True).add_prefix("y2022_"),
            b15.loc[m15_22["base_idx"]].reset_index(drop=True).add_prefix("y2015_"),
        ],
        axis=1,
    )

    b07 = a2007.reset_index(drop=True)
    n15 = a2015.reset_index(drop=True)
    match_07_15 = pd.concat(
        [
            m07_15,
            n15.loc[m07_15["new_idx"]].reset_index(drop=True).add_prefix("y2015_"),
            b07.loc[m07_15["base_idx"]].reset_index(drop=True).add_prefix("y2007_"),
        ],
        axis=1,
    )

    # Write outputs
    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
        for y in years:
            full = aligned[y]
            cols = ["station_base_ft", "raw_dist_ft", "joint", "dus_ft", "joint_len_ft", "event", "depth_pct", "length_in", "width_in", "clock"]
            existing = [c for c in cols if c in full.columns]
            full[existing].to_excel(writer, sheet_name=f"{y}_aligned", index=False)

        a2007.to_excel(writer, sheet_name="anomalies_2007", index=False)
        a2015.to_excel(writer, sheet_name="anomalies_2015", index=False)
        a2022.to_excel(writer, sheet_name="anomalies_2022", index=False)

        match_15_22.to_excel(writer, sheet_name="matches_2015_2022", index=False)
        match_07_15.to_excel(writer, sheet_name="matches_2007_2015", index=False)

    print(f"Done. Wrote {OUTPUT_XLSX}")


if __name__ == "__main__":
    main()
