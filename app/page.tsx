import { CaseBoard } from "@/components/CaseBoard";
import { PasteCase } from "@/components/PasteCase";
import { Reference } from "@/components/Reference";

export default function HomePage() {
  return (
    <>
      <CaseBoard />
      <PasteCase />
      <Reference />
    </>
  );
}
