import { ArrowUpRight, FileText, Focus, Layers } from "lucide-react";
import { FadiLogo } from "./fadi-logo";
import styles from "./career-path-art.module.css";

/** Original, decorative career-loop illustration. Never represents live progress or scores. */
export function CareerPathArt() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.light} />
      <svg className={styles.paths} viewBox="0 0 900 300" fill="none">
        <ellipse cx="450" cy="155" rx="350" ry="105" />
        <ellipse cx="450" cy="155" rx="275" ry="68" />
        <path d="M130 180C250 180 260 80 450 80S650 180 770 180" />
        <path d="M130 180C270 180 320 250 450 250S650 180 770 180" />
      </svg>
      <div className={`${styles.note} ${styles.direction}`}>
        <div className={styles.noteTop}>
          <Focus />
          <span>01 / DIRECTION</span>
          <ArrowUpRight />
        </div>
        <p>
          A move that
          <br />
          <em>means something.</em>
        </p>
        <div className={styles.rule} />
        <span>Your goals. Your choices.</span>
      </div>
      <div className={styles.core}>
        <FadiLogo variant="mark" />
      </div>
      <div className={`${styles.note} ${styles.work}`}>
        <div className={styles.noteTop}>
          <Layers />
          <span>02 / PRACTICE</span>
          <ArrowUpRight />
        </div>
        <p>
          Make room for
          <br />
          <em>the real work.</em>
        </p>
        <div className={styles.rule} />
        <span>Build. Reflect. Try again.</span>
      </div>
      <div className={`${styles.note} ${styles.record}`}>
        <div className={styles.noteTop}>
          <FileText />
          <span>03 / YOUR RECORD</span>
          <ArrowUpRight />
        </div>
        <p>
          Something
          <br />
          <em>to build on.</em>
        </p>
        <div className={styles.rule} />
        <span>Work you can explain.</span>
      </div>
    </div>
  );
}
