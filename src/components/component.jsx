/** Add fonts into your Next.js project:
import { Archivo } from 'next/font/google'
import { Libre_Franklin } from 'next/font/google'

archivo({
  subsets: ['latin'],
  display: 'swap',
})

libre_franklin({
  subsets: ['latin'],
  display: 'swap',
})

To read more about using these font, please visit the Next.js documentation:
- App Directory: https://nextjs.org/docs/app/building-your-application/optimizing/fonts
- Pages Directory: https://nextjs.org/docs/pages/building-your-application/optimizing/fonts
**/
"use client";

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import emailjs from "emailjs-com";
import Image from "next/image"
import Link from "next/link"
import teammates from "../lib/teammates";

import Carousel from "../components/ui/carousel";
import { TlhIcon } from "../components/icons/icons";

export function Component() {
  const sendEmail = (e) => {
    e.preventDefault();

    emailjs.sendForm(
      "service_08ypoqn", // ID service
      "template_52gikj2", // Id Temple
      e.target,
      "8WhVfhy_arB0kXh8_" // Public key
    )
      .then(
        (result) => {
          console.log(result.text);
          alert("Mensaje enviado con éxito");
        },
        (error) => {
          console.log(error.text);
          alert("Hubo un error al enviar el mensaje");
        }
      );
  };

  return (
    (<div className="flex flex-col min-h-[100dvh]">
      <header className="px-4 lg:px-6 h-14 flex items-center bg-primary">
        <Link href="#" className="flex items-center justify-center" prefetch={false}>
          <TlhIcon className="h-6 w-6" />
          <span className="sr-only">TLH Dev</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 text-primary-foreground">
          <a className="text-sm font-bold hover:underline underline-offset-4" prefetch={false}>
            Nosotros
          </a>
          <Link href="#team" className="text-sm font-bold hover:underline underline-offset-4" prefetch={false}>
            Equipo
          </Link>
          <Link href="#projects" className="text-sm font-bold hover:underline underline-offset-4" prefetch={false}>
            Proyectos
          </Link>
          <Link href="#contact" className="text-sm font-bold hover:underline underline-offset-4" prefetch={false}>
            Contacto
          </Link>
        </nav>
      </header>
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32 xl:py-48 bg-primary">
        <div className="container px-4 md:px-6">
          <div
            className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1
                  className="text-3xl font-bold tracking-tighter text-primary-foreground sm:text-5xl xl:text-6xl/none">
                  The Last Hope Development
                </h1>
                <p className="max-w-[550px] text-primary-foreground md:text-xl">
                  Nuestro talentoso equipo de expertos freelance se especializa en crear soluciones digitales excepcionales, personalizadas para satisfacer tus necesidades únicas. Permítenos ayudarte a alcanzar tus objetivos.
                </p>
              </div>
            </div>
            <Image
              src="/home.png"
              width={400}
              height={400}
              alt="Hero"
              className="sm:w-full lg:order-last" />
          </div>
        </div>
      </section>
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32" id="team">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Conoce a nuestro equipo</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              Nuestro talentoso equipo de diseñadores y desarrolladores está dedicado a ofrecer resultados excepcionales para nuestros clientes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
            <Carousel teammates={teammates} />
          </div>
        </div>
      </section>
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32 bg-muted" id="projects">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Proyectos realizados</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              Descubre algunos de los increíbles proyectos en los que hemos trabajado para nuestros clientes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
            <div className="bg-card rounded-lg overflow-hidden">
              <Link
                target="_blank"
                href="https://premium-academy-ashy.vercel.app/">
                <Image
                  src="/pa.png"
                  width={400}
                  height={300}
                  alt="Premium Academy"
                  className="w-full h-48 object-cover"
                  style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              </Link>
              <div className="p-4">
                <h3 className="text-lg font-semibold">Premium Academy</h3>
                <p className="text-muted-foreground">Plataforma de aprendizaje y crecimiento personal</p>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Link
                target="_blank"
                href="https://arcopedicousa.com">
                <Image
                  src="/arcopedicousa.png"
                  width={400}
                  height={300}
                  alt="Arcopedicousa"
                  className="w-full h-48 object-cover"
                  style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              </Link>
              <div className="p-4">
                <h3 className="text-lg font-semibold">Arcopedicousa</h3>
                <p className="text-muted-foreground">Plataforma AWS E-commerce de venta de zapatos</p>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/coding.png"
                width={400}
                height={300}
                alt="Project 3"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Proximamente...</h3>
                <p className="text-muted-foreground">
                  El sitio de tus sueños
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32" id="contact">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Contáctanos</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              ¿Tienes un proyecto en mente? Completa el formulario a continuación y nos pondremos en contacto contigo lo antes posible.
            </p>
            <form onSubmit={sendEmail} className="max-w-md mx-auto mt-8 space-y-4">
              <Input type="text" name="from_name" placeholder="Nombre" className="w-full" />
              <Input type="email" name="to_name" placeholder="Email" className="w-full" />
              <Textarea name="message" placeholder="Mensaje" className="w-full" />
              <Button type="submit" className="w-full">
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </section>
      <footer
        className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 TLH Development. Todos los derechos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
            prefetch={false}>
            Terminos del servicio
          </Link>
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
            prefetch={false}>
            Privacidad
          </Link>
        </nav>
      </footer>
    </div >)
  );
}

