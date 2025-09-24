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
import {
  Code2,
  Palette,
  Database,
  Cloud,
  Server,
  Zap,
  Globe,
  Shield,
  Cpu,
  CodeIcon,
  SmartphoneIcon,
  CloudIcon,
  BuildingIcon,
  LightbulbIcon,
  Bot,
  Coffee,
  Puzzle,
  Leaf,
  Container
} from "lucide-react";

import { useEffect, useState } from "react";

export function Component() {
  const [submitStatus, setSubmitStatus] = useState('');

  useEffect(() => {
    emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY);

    const handleScroll = () => {
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sendEmail = async (e) => {
    e.preventDefault();
    setSubmitStatus('loading');

    const formData = {
      from_name: e.target.elements.from_name.value,
      to_name: e.target.elements.to_name.value,
      message: e.target.elements.message.value,
      origin: "TLH Development",
      date: new Date().toLocaleString('es-ES')
    };

    try {
      const result = await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        {
          from_name: formData.from_name,
          from_email: formData.to_name,
          to_email: "emonsalvep38@gmail.com",
          message: formData.message,
          origin: formData.origin,
          date: formData.date
        }
      );

      setSubmitStatus("success");
      e.target.reset();
    } catch (error) {
      setSubmitStatus("error");
    }
  };

  const technologies = [
    { name: "React", icon: <Globe className="w-8 h-8" />, color: "text-blue-500" },
    { name: "Next.js", icon: <Zap className="w-8 h-8" />, color: "text-black" },
    { name: "TypeScript", icon: <Code2 className="w-8 h-8" />, color: "text-blue-600" },
    { name: "Node.js", icon: <Server className="w-8 h-8" />, color: "text-green-600" },
    { name: "Python", icon: <Cpu className="w-8 h-8" />, color: "text-yellow-600" },
    { name: "Java", icon: <Coffee className="w-8 h-8" />, color: "text-red-500" },
    { name: "Spring Boot", icon: <Leaf className="w-8 h-8" />, color: "text-green-500" },
    { name: "Microservicios", icon: <Puzzle className="w-8 h-8" />, color: "text-purple-500" },
    { name: "AWS", icon: <Cloud className="w-8 h-8" />, color: "text-orange-500" },
    { name: "Tailwind", icon: <Palette className="w-8 h-8" />, color: "text-teal-400" },
    { name: "MongoDB", icon: <Database className="w-8 h-8" />, color: "text-green-500" },
    { name: "PostgreSQL", icon: <Database className="w-8 h-8" />, color: "text-blue-700" },
    { name: "Docker", icon: <Shield className="w-8 h-8" />, color: "text-blue-400" },
    { name: "Kubernetes", icon: <Container className="w-8 h-8" />, color: "text-blue-600" }
  ];

  return (
    <div className="flex flex-col min-h-[100dvh]">
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
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter text-primary-foreground sm:text-5xl xl:text-6xl/none">
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
      <section className="w-full py-12 md:py-24 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Nuestros Servicios</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Soluciones integrales para transformar tus ideas en realidad digital
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CodeIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Desarrollo Web</h3>
              <p className="text-gray-600">
                Aplicaciones modernas con React, Next.js y tecnologías de vanguardia para una experiencia web excepcional
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <SmartphoneIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Apps Móviles</h3>
              <p className="text-gray-600">
                Desarrollo de aplicaciones iOS y Android nativas e híbridas que destacan en las stores
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Inteligencia Artificial y Machine Learning</h3>
              <p className="text-gray-600">
                Soluciones de IA avanzadas incluyendo chatbots inteligentes, análisis predictivo, automatización y procesamiento de lenguaje natural
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CloudIcon className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">DevOps & Cloud</h3>
              <p className="text-gray-600">
                Infraestructura escalable en AWS, Azure y Google Cloud para máxima disponibilidad y rendimiento
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BuildingIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Desarrollo Empresarial</h3>
              <p className="text-gray-600">
                Soluciones a medida para empresas: ERP, CRM, sistemas de gestión y automatización de procesos
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-300 max-w-sm w-full">
              <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <LightbulbIcon className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Consultoría Especializada</h3>
              <p className="text-gray-600">
                Asesoramiento técnico, arquitectura de software y estrategias digitales para optimizar tu negocio
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32 bg-muted" id="team">
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
      <section className="w-full flex items-center justify-center py-12 md:py-24 lg:py-32 " id="projects">
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
      <section className="w-full py-12 md:py-24 bg-gradient-to-br from-gray-50 bg-muted text-center">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Tecnologías que Dominamos</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Utilizamos las herramientas más modernas y eficientes para crear soluciones de alta calidad
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {technologies.map((tech) => (
              <div key={tech.name} className="text-center group">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-3 transition-all duration-300 group-hover:shadow-lg group-hover:scale-110 mx-auto">
                  <div className={tech.color}>
                    {tech.icon}
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">{tech.name}</span>
              </div>
            ))}
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

            {/* Mensajes de estado */}
            {submitStatus === 'success' && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 max-w-md mx-auto">
                ¡Gracias por tu mensaje! Te contactaremos en menos de 24 horas.
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-md mx-auto">
                Hubo un error al enviar el mensaje. Por favor, intenta nuevamente.
              </div>
            )}

            {submitStatus === 'loading' && (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 max-w-md mx-auto">
                Enviando mensaje...
              </div>
            )}

            <form onSubmit={sendEmail} className="max-w-md mx-auto mt-8 space-y-4">
              <Input
                type="text"
                name="from_name"
                placeholder="Tu nombre"
                className="w-full"
                required
              />
              <Input
                type="email"
                name="to_name"
                placeholder="Tu email"
                className="w-full"
                required
              />
              <Textarea
                name="message"
                placeholder="Tu mensaje"
                className="w-full"
                rows={5}
                required
              />
              <Button
                type="submit"
                className="w-full"
                disabled={submitStatus === 'loading'}
              >
                {submitStatus === 'loading' ? 'Enviando...' : 'Enviar Mensaje'}
              </Button>
            </form>
          </div>
        </div>
      </section>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} TLH Development. Todos los derechos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Términos del servicio
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}