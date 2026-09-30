import { useSeoMeta } from "@unhead/react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/egg/Layout";
import { homePath } from "@/lib/siteConfig";
import { Ostrich } from "@/components/egg/Ostrich";

const NotFound = () => {
  useSeoMeta({
    title: "404 | Egg of Ostriches",
    description: "このページは砂の中に埋まってしまったようです。",
  });

  return (
    <Layout>
      <div className="sticker mx-auto mt-10 max-w-lg rounded-3xl bg-card p-8 text-center">
        <Ostrich className="mx-auto h-40 w-36" mood="shock" />
        <h1 className="mt-4 font-display text-6xl text-primary">404</h1>
        <p className="mt-2 font-bold">このページは砂の中に埋まってしまったようです。</p>
        <Link to={homePath()} className="mt-6 inline-block font-extrabold text-primary underline">
          サバンナに戻る
        </Link>
      </div>
    </Layout>
  );
};

export default NotFound;
