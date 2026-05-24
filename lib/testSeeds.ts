/**
 * Curated test seeds for Nexus Phase 2 integration testing and Claude prompt
 * engineering. Each entry includes a seed topic, realistic paper stubs, and
 * hand-authored research directions that represent the intended output quality.
 *
 * Sources drawn from: arXiv, Nature, Cell, Science, PNAS, NEJM, QJE, NBER,
 * NeurIPS, ICML, ICLR proceedings, and Semantic Scholar data.
 */

export interface SeedPaper {
  title: string
  authors: string
  year: number
  citationCount: number
  abstract: string
  tldr?: string
  field: string
}

export interface SeedDirection {
  title: string
  description: string
  noveltyScore: number
  feasibilityScore: number
  rationale: string
}

export interface SeedTopic {
  id: string
  topic: string
  field: string
  papers: SeedPaper[]
  directions: SeedDirection[]
  outlierCandidate?: SeedPaper
}

// ─── COMPUTER SCIENCE ────────────────────────────────────────────────────────

const diffusionModels: SeedTopic = {
  id: 'cs-diffusion-models',
  topic: 'diffusion models for image generation',
  field: 'machine_learning',
  papers: [
    {
      title: 'Denoising Diffusion Probabilistic Models',
      authors: 'Ho et al.',
      year: 2020,
      citationCount: 21000,
      abstract: 'We present high quality image synthesis results using diffusion probabilistic models, a class of latent variable models inspired by nonequilibrium thermodynamics.',
      tldr: 'DDPM achieves high-quality image synthesis by learning to reverse a gradual noising process.',
      field: 'machine_learning',
    },
    {
      title: 'Score-Based Generative Modeling through Stochastic Differential Equations',
      authors: 'Song et al.',
      year: 2021,
      citationCount: 9400,
      abstract: 'We present a stochastic differential equation (SDE) framework that generalizes score-based generative models and diffusion probabilistic models.',
      field: 'machine_learning',
    },
    {
      title: 'High-Resolution Image Synthesis with Latent Diffusion Models',
      authors: 'Rombach et al.',
      year: 2022,
      citationCount: 14200,
      abstract: 'By decomposing the image formation process into a sequential application of denoising autoencoders, diffusion models achieve state-of-the-art synthesis results while allowing for precise control.',
      tldr: 'Latent diffusion moves synthesis into a compressed latent space, dramatically reducing compute.',
      field: 'machine_learning',
    },
  ],
  directions: [
    {
      title: 'Diffusion Models for Protein Conformation Sampling',
      description: 'Apply score-based diffusion to sample from protein conformational ensembles, bypassing expensive MD simulations. Score function trained on PDB + AlphaFold structure database.',
      noveltyScore: 9,
      feasibilityScore: 7,
      rationale: 'RFdiffusion demonstrates feasibility for backbone design; gap is in dynamics/ensemble sampling rather than single-structure generation.',
    },
    {
      title: 'Consistency Models for Real-Time Scientific Image Denoising',
      description: 'Consistency distillation from pre-trained diffusion models to produce single-step denoisers for cryo-EM and fluorescence microscopy, enabling real-time processing.',
      noveltyScore: 7,
      feasibilityScore: 8,
      rationale: 'Scientific imaging desperately needs speed; consistency models achieve ~1-step inference at near-diffusion quality.',
    },
  ],
  outlierCandidate: {
    title: 'Thermodynamic Formulation of Neural Network Training as Entropy Minimization',
    authors: 'Lyu & Li',
    year: 2020,
    citationCount: 340,
    abstract: 'We show that implicit bias of gradient descent on homogeneous networks can be understood through a thermodynamic lens, connecting training dynamics to free energy minimization.',
    field: 'machine_learning',
  },
}

const graphNeuralNetworks: SeedTopic = {
  id: 'cs-gnns',
  topic: 'graph neural networks for molecular property prediction',
  field: 'machine_learning',
  papers: [
    {
      title: 'Semi-Supervised Classification with Graph Convolutional Networks',
      authors: 'Kipf & Welling',
      year: 2017,
      citationCount: 26000,
      abstract: 'We present a scalable approach for semi-supervised learning on graph-structured data based on an efficient variant of convolutional neural networks.',
      tldr: 'GCNs propagate node features through graph structure for semi-supervised learning.',
      field: 'machine_learning',
    },
    {
      title: 'Molecular Graph Convolutions: Moving Beyond Fingerprints',
      authors: 'Kearnes et al.',
      year: 2016,
      citationCount: 3800,
      abstract: 'We introduce molecular graph convolutions, a machine learning architecture for learning from undirected graphs, with application to drug discovery.',
      field: 'cheminformatics',
    },
    {
      title: 'Equivariant Graph Neural Networks for 3D Molecular Geometry',
      authors: 'Schütt et al.',
      year: 2021,
      citationCount: 2200,
      abstract: 'We present PaiNN, an equivariant message passing neural network that respects rotational and translational symmetry for molecular property prediction.',
      tldr: 'Equivariant message passing respects 3D geometry and improves molecular property prediction.',
      field: 'machine_learning',
    },
  ],
  directions: [
    {
      title: 'GNN-Guided ADMET Prediction with Uncertainty Quantification',
      description: 'Combine equivariant GNNs with conformal prediction to provide calibrated uncertainty estimates on ADMET properties, enabling risk-stratified drug candidate triage.',
      noveltyScore: 7,
      feasibilityScore: 9,
      rationale: 'ADMET failure is a leading cause of late-stage drug attrition; uncertainty quantification is largely absent from current tools.',
    },
  ],
}

// ─── COMPUTATIONAL BIOLOGY ───────────────────────────────────────────────────

const proteinStructure: SeedTopic = {
  id: 'bio-protein-structure',
  topic: 'protein structure prediction and function annotation',
  field: 'biology',
  papers: [
    {
      title: 'Highly Accurate Protein Structure Prediction with AlphaFold',
      authors: 'Jumper et al.',
      year: 2021,
      citationCount: 32000,
      abstract: 'We developed AlphaFold, an attention-based deep learning model that achieves atomic-level accuracy in protein structure prediction without templates in the majority of cases.',
      tldr: 'AlphaFold solves the protein folding problem with near-experimental accuracy.',
      field: 'biology',
    },
    {
      title: 'Evolutionary-Scale Prediction of Atomic Level Structure with a Large Language Model',
      authors: 'Lin et al.',
      year: 2023,
      citationCount: 5100,
      abstract: 'We train ESM-2, a language model over protein sequences, whose representations enable atomic resolution structure prediction via the ESMFold architecture.',
      tldr: 'ESM-2 enables fast structure prediction at scale from sequence alone.',
      field: 'biology',
    },
    {
      title: 'Protein Function Prediction Using Deep Learning',
      authors: 'Gligorijević et al.',
      year: 2021,
      citationCount: 1100,
      abstract: 'DeepFRI uses graph convolutional networks over protein contact maps to predict Gene Ontology function terms with structural context.',
      field: 'biology',
    },
  ],
  directions: [
    {
      title: 'Sparse Functional Annotation of Dark Proteome via Contrastive Structure Embeddings',
      description: 'Use contrastive learning over ESMFold-predicted structures to cluster the ~80% of proteins with no known function, then transfer annotations from labeled neighbors.',
      noveltyScore: 8,
      feasibilityScore: 8,
      rationale: 'UniProt dark proteome is massive and underexplored; structure is now cheap to predict and more conserved than sequence at distant homologs.',
    },
    {
      title: 'Cross-Kingdom Function Transfer Using Structural Similarity Graphs',
      description: 'Build a protein structural similarity graph across kingdoms (bacteria → insects → mammals). Propagate GO annotations via label propagation weighted by TM-score.',
      noveltyScore: 7,
      feasibilityScore: 9,
      rationale: 'Directly relevant to ProtFunc work; structural similarity often survives where sequence identity is undetectable.',
    },
  ],
}

const singleCellRNA: SeedTopic = {
  id: 'bio-scrna',
  topic: 'single-cell RNA sequencing analysis and cell type discovery',
  field: 'biology',
  papers: [
    {
      title: 'Massively Parallel Digital Transcriptional Profiling of Single Cells',
      authors: 'Zheng et al.',
      year: 2017,
      citationCount: 11800,
      abstract: 'We developed a massively parallel single-cell RNA-seq platform based on droplet microfluidics (10x Chromium) and use it to profile thousands of cells.',
      tldr: 'Droplet microfluidics enables profiling of thousands of cells simultaneously.',
      field: 'biology',
    },
    {
      title: 'Comprehensive Integration of Single-Cell Data',
      authors: 'Stuart et al.',
      year: 2019,
      citationCount: 9200,
      abstract: 'We present methods for comprehensive integration of single-cell data, including canonical correlation analysis for cross-dataset integration.',
      field: 'biology',
    },
    {
      title: 'Trajectory Inference Across Thousands of Single Cells Reveals Cell-Fate Determinism',
      authors: 'Weinreb et al.',
      year: 2018,
      citationCount: 1700,
      abstract: 'We present a method for recovering lineage trees from static scRNA-seq snapshots using diffusion pseudotime and optimal transport.',
      field: 'biology',
    },
  ],
  directions: [
    {
      title: 'Foundation Models for Cell Type Annotation Across Tissues and Species',
      description: 'Fine-tune scFoundation or Geneformer on cross-species single-cell atlases to enable zero-shot cell type annotation, reducing manual curation bottleneck.',
      noveltyScore: 8,
      feasibilityScore: 7,
      rationale: 'CellTypist and scANVI require reference atlases; a foundation model could generalize to novel tissues/species without retraining.',
    },
  ],
  outlierCandidate: {
    title: 'Optimal Transport Theory for Biological Development',
    authors: 'Schiebinger et al.',
    year: 2019,
    citationCount: 1200,
    abstract: 'We introduce Waddington-OT, using optimal transport to infer developmental trajectories from snapshots of single-cell data at multiple time points.',
    field: 'mathematics',
  },
}

// ─── NEUROSCIENCE ────────────────────────────────────────────────────────────

const neuralCoding: SeedTopic = {
  id: 'neuro-neural-coding',
  topic: 'population coding and neural representations in cortex',
  field: 'neuroscience',
  papers: [
    {
      title: 'A High-Performance Neural Prosthesis Enabled by Control Algorithm Design',
      authors: 'Gilja et al.',
      year: 2012,
      citationCount: 1300,
      abstract: 'Using a feedback-control approach to decode neural activity for BCI cursor movement achieves significant performance improvements over existing decoders.',
      field: 'neuroscience',
    },
    {
      title: 'Unsupervised Discovery of Demixed, Low-Dimensional Neural Dynamics Across Multiple Timescales',
      authors: 'Perez-Nieves et al.',
      year: 2021,
      citationCount: 410,
      abstract: 'We present a method to disentangle task-relevant from task-irrelevant sources of variance in high-dimensional neural recordings.',
      field: 'neuroscience',
    },
    {
      title: 'Geometry of Abstract Knowledge in the Hippocampus',
      authors: 'Whittington et al.',
      year: 2022,
      citationCount: 780,
      abstract: 'We show that the hippocampus encodes abstract relational knowledge in a geometry that generalizes across specific instances, supporting flexible inference.',
      tldr: 'Hippocampal representations support abstract relational reasoning via structured geometry.',
      field: 'neuroscience',
    },
  ],
  directions: [
    {
      title: 'Transformer Architectures as Models of Cortical Hierarchy',
      description: 'Map transformer attention heads to cortical feedback/feedforward circuits. Test if hierarchical attention predicts neural geometry in V1→V4→IT using representational similarity analysis.',
      noveltyScore: 8,
      feasibilityScore: 7,
      rationale: 'Yamins & DiCarlo showed CNNs predict V1/V4/IT; transformers add temporal/contextual dynamics not captured by feedforward CNNs.',
    },
    {
      title: 'Manifold Topology of Motor Cortex During Reach Planning',
      description: 'Apply persistent homology to motor cortex population recordings to characterize the topological structure of preparatory neural activity across different reach directions.',
      noveltyScore: 9,
      feasibilityScore: 6,
      rationale: 'Low-dimensional structure in motor cortex is well-established; topology (not just dimensionality) has not been systematically characterized.',
    },
  ],
}

// ─── ECONOMICS ───────────────────────────────────────────────────────────────

const behavioralEcon: SeedTopic = {
  id: 'econ-behavioral',
  topic: 'behavioral economics and bounded rationality in decision-making',
  field: 'economics',
  papers: [
    {
      title: 'Prospect Theory: An Analysis of Decision Under Risk',
      authors: 'Kahneman & Tversky',
      year: 1979,
      citationCount: 72000,
      abstract: 'This paper presents a critique of expected utility theory as a descriptive model of decision under risk, and develops an alternative model called prospect theory.',
      tldr: 'Prospect theory captures loss aversion and probability weighting in human decision-making.',
      field: 'economics',
    },
    {
      title: 'A Model of Reference-Dependent Preferences',
      authors: 'Kőszegi & Rabin',
      year: 2006,
      citationCount: 4100,
      abstract: 'We develop a model of reference-dependent preferences where the reference point is the rational-expectations equilibrium of the economic situation.',
      field: 'economics',
    },
    {
      title: 'Machine Learning as a Tool for Hypothesis Generation',
      authors: 'Ludwig & Mullainathan',
      year: 2024,
      citationCount: 310,
      abstract: 'We show that ML models can identify patterns in existing data that generate testable hypotheses humans would not have proposed. Applied to behavioral anomalies in financial markets.',
      tldr: 'ML identifies behavioral patterns in data that suggest new economic hypotheses.',
      field: 'economics',
    },
  ],
  directions: [
    {
      title: 'LLM-Based Survey Instruments for Measuring Loss Aversion at Scale',
      description: 'Replace expensive lab experiments with Claude/GPT-based conversational elicitation of loss aversion coefficients across culturally diverse populations. Validate against MTurk benchmarks.',
      noveltyScore: 8,
      feasibilityScore: 8,
      rationale: 'Lab-based measures are expensive; LLMs could enable cross-cultural behavioral economics at scale if validated.',
    },
    {
      title: 'Natural Experiments in Digital Markets for Testing Endowment Effect',
      description: 'Exploit platform design changes (e.g., default ownership framing in marketplaces) as quasi-experiments to identify endowment effects without laboratory settings.',
      noveltyScore: 7,
      feasibilityScore: 9,
      rationale: 'Digital markets generate large natural experiment datasets; endowment effect estimates vary wildly across studies — field-scale measurement would settle debates.',
    },
  ],
}

// ─── PHYSICS ─────────────────────────────────────────────────────────────────

const quantumErrorCorrection: SeedTopic = {
  id: 'phys-qec',
  topic: 'quantum error correction and fault-tolerant quantum computing',
  field: 'physics',
  papers: [
    {
      title: 'Fault-Tolerant Quantum Computation with High Threshold in Two Dimensions',
      authors: 'Fowler et al.',
      year: 2012,
      citationCount: 4200,
      abstract: 'We develop the surface code, a topological quantum error correcting code that is highly effective against local errors and amenable to near-term hardware.',
      tldr: 'Surface codes enable fault-tolerant QC with high error thresholds on 2D grids.',
      field: 'physics',
    },
    {
      title: 'Quantum Error Correction: An Introductory Guide',
      authors: 'Devitt, Munro & Nemoto',
      year: 2013,
      citationCount: 1900,
      abstract: 'A comprehensive introduction to quantum error correction, covering stabilizer codes, fault tolerance, and the threshold theorem.',
      field: 'physics',
    },
    {
      title: 'Suppressing Quantum Errors by Scaling a Surface Code Logical Qubit',
      authors: 'Google Quantum AI',
      year: 2023,
      citationCount: 1800,
      abstract: 'We demonstrate that increasing the code distance of a surface code suppresses errors exponentially, achieving below-threshold quantum error correction.',
      tldr: 'Google demonstrates below-threshold quantum error suppression with surface codes.',
      field: 'physics',
    },
  ],
  directions: [
    {
      title: 'ML Decoders for Surface Codes Under Non-Markovian Noise',
      description: 'Train transformer-based decoders on synthetic non-Markovian noise models that better represent real superconducting qubit hardware, replacing minimum-weight perfect matching.',
      noveltyScore: 8,
      feasibilityScore: 7,
      rationale: 'MWPM assumes i.i.d. errors; real hardware has correlated noise from crosstalk and leakage. NN decoders showed promise for i.i.d. noise — extension to correlated is open.',
    },
  ],
  outlierCandidate: {
    title: 'Topological Phases in Non-Hermitian Systems',
    authors: 'Gong et al.',
    year: 2018,
    citationCount: 1600,
    abstract: 'We classify topological phases in non-Hermitian Hamiltonians, which naturally arise in open quantum systems and may host exotic edge modes relevant for sensing.',
    field: 'physics',
  },
}

// ─── CLIMATE SCIENCE ─────────────────────────────────────────────────────────

const climateML: SeedTopic = {
  id: 'climate-ml',
  topic: 'machine learning for climate modeling and weather prediction',
  field: 'climate',
  papers: [
    {
      title: 'Skilful Precipitation Nowcasting Using Deep Generative Models of Radar',
      authors: 'Ravuri et al. (DeepMind)',
      year: 2021,
      citationCount: 2100,
      abstract: 'We present a generative deep learning model for precipitation nowcasting that outperforms traditional approaches and is favored by meteorologists.',
      tldr: 'Deep generative models produce better precipitation nowcasts than physical models at short lead times.',
      field: 'climate',
    },
    {
      title: 'FourCastNet: A Global Data-Driven High-Resolution Weather Model',
      authors: 'Pathak et al. (NVIDIA)',
      year: 2022,
      citationCount: 1400,
      abstract: 'FourCastNet uses Fourier neural operators to produce global weather forecasts at 0.25° resolution that match ECMWF operational skill at fraction of the cost.',
      field: 'climate',
    },
    {
      title: 'Accurate Medium-Range Global Weather Forecasting with 3D Neural Networks',
      authors: 'Bi et al. (Huawei)',
      year: 2023,
      citationCount: 2600,
      abstract: 'Pangu-Weather achieves medium-range forecast accuracy competitive with ECMWF IFS, using hierarchical 3D transformers trained on 39 years of ERA5 reanalysis.',
      tldr: 'Pangu-Weather matches ECMWF operational forecasts using a 3D transformer trained on ERA5.',
      field: 'climate',
    },
  ],
  directions: [
    {
      title: 'Emulator-Based Uncertainty Quantification for IPCC-Class Climate Projections',
      description: 'Train neural emulators on CMIP6 ensemble outputs to cheaply propagate uncertainty through long-horizon climate projections, enabling much larger parameter sweeps.',
      noveltyScore: 8,
      feasibilityScore: 7,
      rationale: 'Full CMIP6 runs cost millions of CPU hours; emulators could democratize uncertainty quantification for policy applications.',
    },
    {
      title: 'Cross-Domain Transfer from Weather Forecasting to Subseasonal-to-Seasonal Prediction',
      description: 'Fine-tune FourCastNet/Pangu on S2S prediction tasks. Test whether synoptic-scale skill transfers to 2-6 week range where models currently struggle.',
      noveltyScore: 7,
      feasibilityScore: 6,
      rationale: 'S2S predictability gap is well-known; large pretrained weather models may encode teleconnection patterns useful at longer lead times.',
    },
  ],
}

// ─── CHEMISTRY ───────────────────────────────────────────────────────────────

const retrosynthesis: SeedTopic = {
  id: 'chem-retrosynthesis',
  topic: 'retrosynthesis planning and chemical reaction prediction',
  field: 'chemistry',
  papers: [
    {
      title: 'Planning Chemical Syntheses with Deep Neural Networks and Symbolic AI',
      authors: 'Segler et al.',
      year: 2018,
      citationCount: 2700,
      abstract: 'We combine Monte Carlo tree search with neural networks trained on millions of reactions to plan multi-step chemical syntheses, matching expert chemist quality.',
      tldr: 'MCTS + neural networks plan multi-step syntheses at expert level.',
      field: 'chemistry',
    },
    {
      title: 'Molecular Transformer: A Model for Uncertainty-Calibrated Chemical Reaction Prediction',
      authors: 'Schwaller et al.',
      year: 2019,
      citationCount: 2100,
      abstract: 'We treat chemical reaction prediction as a translation task using the Transformer architecture, achieving state-of-the-art product prediction on USPTO benchmarks.',
      field: 'chemistry',
    },
    {
      title: 'Generative Models for Drug Discovery and Retrosynthesis',
      authors: 'Coley et al.',
      year: 2020,
      citationCount: 890,
      abstract: 'Review of generative ML approaches for molecular design, synthesis prediction, and reaction condition optimization.',
      field: 'chemistry',
    },
  ],
  directions: [
    {
      title: 'LLM-Guided Retrosynthesis with Patent Literature Retrieval',
      description: 'Augment neural retrosynthesis with retrieval from patent chemical databases (USPTO, EPO). Claude retrieves similar prior art reactions and suggests novel analogues for target molecules.',
      noveltyScore: 8,
      feasibilityScore: 8,
      rationale: 'Current models trained on USPTO reactions miss recent patent literature; retrieval-augmented synthesis could surface novel transformations.',
    },
  ],
}

// ─── MEDICINE / CLINICAL ─────────────────────────────────────────────────────

const clinicalNLP: SeedTopic = {
  id: 'med-clinical-nlp',
  topic: 'clinical NLP and information extraction from electronic health records',
  field: 'medicine',
  papers: [
    {
      title: 'BioBERT: A Pre-trained Biomedical Language Representation Model',
      authors: 'Lee et al.',
      year: 2020,
      citationCount: 6800,
      abstract: 'We pre-train BERT on PubMed abstracts and PMC full texts, achieving state-of-the-art on biomedical NER, RE, and QA benchmarks.',
      tldr: 'Domain-specific BERT pretraining significantly improves biomedical NLP.',
      field: 'medicine',
    },
    {
      title: 'Large Language Models Encode Clinical Knowledge',
      authors: 'Singhal et al. (Google)',
      year: 2023,
      citationCount: 3200,
      abstract: 'Med-PaLM achieves physician-level performance on USMLE-style questions, demonstrating that large language models encode substantial clinical knowledge.',
      tldr: 'LLMs can pass medical licensing exams at physician-level accuracy.',
      field: 'medicine',
    },
    {
      title: 'Phenotyping from EHR Data Using Weak Supervision',
      authors: 'Dunnmon et al.',
      year: 2020,
      citationCount: 720,
      abstract: 'We apply programmatic weak supervision to automate clinical phenotyping from EHR text without manually labeling large datasets.',
      field: 'medicine',
    },
  ],
  directions: [
    {
      title: 'Privacy-Preserving Clinical NLP via Federated Fine-Tuning',
      description: 'Fine-tune Med-PaLM or ClinicalBERT across hospital systems using federated learning, without patient data leaving institutional firewalls. Benchmark against centrally-trained baselines.',
      noveltyScore: 8,
      feasibilityScore: 6,
      rationale: 'Data sharing agreements block centralized clinical NLP at scale; federated learning is the natural solution but rarely applied to clinical transformers.',
    },
    {
      title: 'Temporal Reasoning in EHR for Adverse Event Prediction',
      description: 'Build transformer models that reason explicitly over longitudinal EHR timelines to predict adverse drug events, exploiting temporal ordering of diagnoses and prescriptions.',
      noveltyScore: 7,
      feasibilityScore: 8,
      rationale: 'Most clinical NLP treats records as bags of codes; temporal structure is crucial for prediction but underexploited.',
    },
  ],
}

// ─── ALL SEEDS ────────────────────────────────────────────────────────────────

export const ALL_SEEDS: SeedTopic[] = [
  diffusionModels,
  graphNeuralNetworks,
  proteinStructure,
  singleCellRNA,
  neuralCoding,
  behavioralEcon,
  quantumErrorCorrection,
  climateML,
  retrosynthesis,
  clinicalNLP,
]

/** Flat list of all unique seed topic strings for smoke testing. */
export const SEED_TOPIC_STRINGS = ALL_SEEDS.map((s) => s.topic)

/** Find a seed by ID. */
export function getSeedById(id: string): SeedTopic | undefined {
  return ALL_SEEDS.find((s) => s.id === id)
}

/** Return all seeds for a given field. */
export function getSeedsByField(field: string): SeedTopic[] {
  return ALL_SEEDS.filter((s) => s.field === field)
}
